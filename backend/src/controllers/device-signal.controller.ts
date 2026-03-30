import { Request, Response } from 'express';
import {
    upsertSignal,
    getSignalsForDate,
    getLatestSignals,
    type AppSessionData,
    type LocationSummaryData,
    type ScreenTimeData,
    type SignalType,
    type SpotifyData,
    type WellnessCheckinData,
} from '../services/device-signal.service';

const VALID_SIGNAL_TYPES = new Set<string>([
    'location_summary', 'calendar', 'spotify', 'screen_time',
    'app_session', 'notification', 'wellness_checkin',
]);

type LatestSignalsRecord = Partial<Record<SignalType, { date: Date; data: unknown; source: string }>>;

type DeviceDashboardSignalSummary = {
    location?: { placeName: string; visitCount: number } | null;
    spotify?: { mood: string; topGenre: string; tracksPlayed: number } | null;
    screenTime?: { feeling: string; level: number } | null;
    appSession?: { totalMinutes: number; sessions: number } | null;
    wellness?: { energyLevel: number; stressLevel: number; socialBattery: number } | null;
};

const clampLevel = (value: unknown) => {
    const level = Number(value);
    return Number.isFinite(level) ? Math.min(5, Math.max(1, Math.round(level))) : null;
};

const getScreenTimeFeeling = (level: number | null) => {
    if (level === null) return 'mixed';
    if (level <= 1) return 'light';
    if (level === 2) return 'steady';
    if (level === 3) return 'full';
    if (level === 4) return 'heavy';
    return 'overloaded';
};

const summarizeLatestSignals = (latest: LatestSignalsRecord): DeviceDashboardSignalSummary => {
    const summary: DeviceDashboardSignalSummary = {};

    const location = latest.location_summary?.data as LocationSummaryData | undefined;
    if (location?.dominantPlace) {
        summary.location = {
            placeName: location.dominantPlace,
            visitCount: Array.isArray(location.placesVisited)
                ? Math.max(location.placesVisited.length, 1)
                : 1,
        };
    }

    const spotify = latest.spotify?.data as SpotifyData | undefined;
    if (spotify && (spotify.moodLabel || spotify.tracksPlayed || spotify.topGenres?.length)) {
        summary.spotify = {
            mood: spotify.moodLabel || 'mixed',
            topGenre: Array.isArray(spotify.topGenres) ? spotify.topGenres[0] || '' : '',
            tracksPlayed: Number(spotify.tracksPlayed || 0),
        };
    }

    const screenTime = latest.screen_time?.data as ScreenTimeData | undefined;
    const overwhelmLevel = clampLevel(screenTime?.overwhelmLevel);
    if (screenTime && (screenTime.totalMinutes !== null || overwhelmLevel !== null)) {
        summary.screenTime = {
            feeling: getScreenTimeFeeling(overwhelmLevel),
            level: overwhelmLevel ?? 3,
        };
    }

    const appSession = latest.app_session?.data as AppSessionData | undefined;
    if (appSession && (appSession.totalMinutes || appSession.sessions)) {
        summary.appSession = {
            totalMinutes: Number(appSession.totalMinutes || 0),
            sessions: Number(appSession.sessions || 0),
        };
    }

    const wellness = latest.wellness_checkin?.data as WellnessCheckinData | undefined;
    if (wellness && (
        wellness.energyLevel !== null
        || wellness.stressLevel !== null
        || wellness.socialBattery !== null
    )) {
        summary.wellness = {
            energyLevel: clampLevel(wellness.energyLevel) ?? 0,
            stressLevel: clampLevel(wellness.stressLevel) ?? 0,
            socialBattery: clampLevel(wellness.socialBattery) ?? 0,
        };
    }

    return summary;
};

/**
 * POST /api/v1/device/signal
 * Upsert a device signal. Body: { signalType, date?, data, source? }
 */
export const postDeviceSignal = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        const { signalType, date, data, source } = req.body || {};

        if (!signalType || !VALID_SIGNAL_TYPES.has(signalType)) {
            return res.status(400).json({ message: `signalType must be one of: ${[...VALID_SIGNAL_TYPES].join(', ')}` });
        }
        if (!data || typeof data !== 'object') {
            return res.status(400).json({ message: 'data must be a JSON object' });
        }

        const signalDate = date ? new Date(date) : new Date();
        if (Number.isNaN(signalDate.getTime())) {
            return res.status(400).json({ message: 'Invalid date' });
        }

        const validSources = ['AUTO', 'SELF_REPORT', 'API'];
        const signalSource = validSources.includes(source) ? source : 'AUTO';

        const signal = await upsertSignal(userId, signalDate, signalType as SignalType, data, signalSource);
        return res.status(201).json({ ok: true, signal });
    } catch (error) {
        console.error('Post device signal error:', error);
        return res.status(500).json({ message: 'Failed to save device signal' });
    }
};

/**
 * GET /api/v1/device/signals?date=YYYY-MM-DD
 * Get all signals for a specific date (defaults to today).
 */
export const getDeviceSignals = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        const dateStr = typeof req.query.date === 'string' ? req.query.date : null;
        const date = dateStr ? new Date(dateStr) : new Date();

        if (Number.isNaN(date.getTime())) {
            return res.status(400).json({ message: 'Invalid date' });
        }

        const signals = await getSignalsForDate(userId, date);
        return res.json({ signals });
    } catch (error) {
        console.error('Get device signals error:', error);
        return res.status(500).json({ message: 'Failed to fetch device signals' });
    }
};

/**
 * GET /api/v1/device/latest
 * Get the most recent signal of each type.
 */
export const getLatestDeviceSignals = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        const latest = await getLatestSignals(userId);
        return res.json({ signals: summarizeLatestSignals(latest) });
    } catch (error) {
        console.error('Get latest device signals error:', error);
        return res.status(500).json({ message: 'Failed to fetch latest signals' });
    }
};

/**
 * POST /api/v1/device/wellness-checkin
 * Convenience endpoint for daily wellness self-report.
 * Body: { energyLevel, socialBattery, stressLevel, screenTimeFeeling, notificationPressure, notes? }
 */
export const postWellnessCheckin = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        const { energyLevel, socialBattery, stressLevel, screenTimeFeeling, notificationPressure, notes } = req.body || {};

        const clamp = (v: unknown, min: number, max: number) => {
            const n = Number(v);
            return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : null;
        };

        const data = {
            energyLevel: clamp(energyLevel, 1, 5),
            socialBattery: clamp(socialBattery, 1, 5),
            stressLevel: clamp(stressLevel, 1, 5),
            screenTimeFeeling: clamp(screenTimeFeeling, 1, 5),
            notificationPressure: clamp(notificationPressure, 1, 5),
            notes: typeof notes === 'string' ? notes.slice(0, 500) : null,
        };

        // Validate at least one field is provided
        if (Object.values(data).every((v) => v === null)) {
            return res.status(400).json({ message: 'At least one wellness metric is required' });
        }

        const signal = await upsertSignal(userId, new Date(), 'wellness_checkin', data as Record<string, unknown>, 'SELF_REPORT');

        // Also upsert derived signals for screen time and notification
        if (data.screenTimeFeeling !== null) {
            await upsertSignal(userId, new Date(), 'screen_time', {
                totalMinutes: null,
                socialMediaMinutes: null,
                source: 'self_report',
                overwhelmLevel: 6 - data.screenTimeFeeling, // invert: 1=balanced→5=overwhelmed
            }, 'SELF_REPORT');
        }

        if (data.notificationPressure !== null) {
            await upsertSignal(userId, new Date(), 'notification', {
                estimatedCount: null,
                overwhelmLevel: data.notificationPressure,
                source: 'self_report',
            }, 'SELF_REPORT');
        }

        return res.status(201).json({ ok: true, signal });
    } catch (error) {
        console.error('Post wellness checkin error:', error);
        return res.status(500).json({ message: 'Failed to save wellness check-in' });
    }
};

/**
 * POST /api/v1/device/app-session
 * Track Notive app session data.
 * Body: { sessionMinutes, entriesWritten? }
 */
export const postAppSession = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        const { sessionMinutes, entriesWritten } = req.body || {};

        const mins = Number(sessionMinutes);
        if (!Number.isFinite(mins) || mins <= 0) {
            return res.status(400).json({ message: 'sessionMinutes must be a positive number' });
        }

        // Get existing today session to accumulate
        const today = new Date();
        const existing = await getSignalsForDate(userId, today);
        const existingSession = existing.find((s) => s.signalType === 'app_session');
        const prev = existingSession?.data as Record<string, number> | null;

        const data = {
            sessions: (prev?.sessions ?? 0) + 1,
            totalMinutes: Math.round((prev?.totalMinutes ?? 0) + mins),
            longestSessionMinutes: Math.max(prev?.longestSessionMinutes ?? 0, Math.round(mins)),
            entriesWritten: (prev?.entriesWritten ?? 0) + (Number(entriesWritten) || 0),
        };

        const signal = await upsertSignal(userId, today, 'app_session', data, 'AUTO');
        return res.status(201).json({ ok: true, signal });
    } catch (error) {
        console.error('Post app session error:', error);
        return res.status(500).json({ message: 'Failed to save app session' });
    }
};
