/**
 * Device Signal Service
 *
 * Unified interface for storing and querying device-level context signals.
 * Signal types: location_summary, calendar, spotify, screen_time, app_session,
 *               notification, wellness_checkin
 *
 * All signals are per-user-per-day with flexible JSON payloads.
 */

import prisma from '../config/prisma';
import type { Prisma } from '@prisma/client';

// ── Signal Type Definitions ─────────────────────────────────

export type SignalType =
    | 'location_summary'   // Daily location context (places visited, dominant place)
    | 'calendar'           // Daily busyness from Google Calendar
    | 'spotify'            // Daily music listening summary
    | 'screen_time'        // Daily screen time (self-report or device API)
    | 'app_session'        // Notive in-app session tracking
    | 'notification'       // Notification pressure proxy
    | 'wellness_checkin';  // Self-reported daily check-in

export type LocationSummaryData = {
    dominantPlace: string;        // "Home", "School", "Library", etc.
    placesVisited: string[];
    entryLocations: Array<{
        entryId: string;
        lat: number;
        lng: number;
        name: string;
    }>;
};

export type CalendarData = {
    totalEvents: number;
    meetingMinutes: number;       // total duration of meetings
    freeBlocks: number;           // count of free 1hr+ gaps
    busiestHour: number | null;   // 0-23
    categories: Record<string, number>; // event category counts
};

export type SpotifyData = {
    tracksPlayed: number;
    totalMinutes: number;
    avgValence: number;           // 0-1, musical positivity
    avgEnergy: number;            // 0-1, musical intensity
    topGenres: string[];
    topArtists: string[];
    moodLabel: string;            // derived: "upbeat", "chill", "melancholy", "energetic"
};

export type ScreenTimeData = {
    totalMinutes: number;
    socialMediaMinutes: number | null;
    source: 'device_api' | 'self_report';
    overwhelmLevel: number | null;  // 1-5 self-report
};

export type AppSessionData = {
    sessions: number;
    totalMinutes: number;
    longestSessionMinutes: number;
    entriesWritten: number;
};

export type NotificationData = {
    estimatedCount: number | null;
    overwhelmLevel: number;       // 1-5 self-report
    source: 'device_api' | 'self_report';
};

export type WellnessCheckinData = {
    energyLevel: number;          // 1-5
    socialBattery: number;        // 1-5
    stressLevel: number;          // 1-5
    screenTimeFeeling: number;    // 1-5 (1=too much, 5=balanced)
    notificationPressure: number; // 1-5
    notes: string | null;
};

// ── Core CRUD ────────────────────────────────────────────────

/**
 * Upsert a device signal for a given user, date, and type.
 * Uses upsert to avoid duplicates — one signal per type per day.
 */
export async function upsertSignal(
    userId: string,
    date: Date,
    signalType: SignalType,
    data: Record<string, unknown>,
    source: 'AUTO' | 'SELF_REPORT' | 'API' = 'AUTO'
) {
    const dateOnly = stripTime(date);
    const jsonData = data as unknown as Prisma.InputJsonValue;

    return prisma.deviceSignal.upsert({
        where: {
            userId_date_signalType: { userId, date: dateOnly, signalType },
        },
        create: { userId, date: dateOnly, signalType, data: jsonData, source },
        update: { data: jsonData, source, updatedAt: new Date() },
    });
}

/**
 * Get all signals for a user on a specific date.
 */
export async function getSignalsForDate(userId: string, date: Date) {
    return prisma.deviceSignal.findMany({
        where: { userId, date: stripTime(date) },
    });
}

/**
 * Get signals of a specific type within a date range.
 */
export async function getSignalRange(
    userId: string,
    signalType: SignalType,
    startDate: Date,
    endDate: Date
) {
    return prisma.deviceSignal.findMany({
        where: {
            userId,
            signalType,
            date: { gte: stripTime(startDate), lte: stripTime(endDate) },
        },
        orderBy: { date: 'asc' },
    });
}

/**
 * Get the latest signal of each type for a user (for dashboard overview).
 */
export async function getLatestSignals(userId: string) {
    const types: SignalType[] = [
        'location_summary', 'calendar', 'spotify',
        'screen_time', 'app_session', 'notification', 'wellness_checkin',
    ];

    const results = await Promise.all(
        types.map((signalType) =>
            prisma.deviceSignal.findFirst({
                where: { userId, signalType },
                orderBy: { date: 'desc' },
            })
        )
    );

    const map: Partial<Record<SignalType, { date: Date; data: unknown; source: string }>> = {};
    for (let i = 0; i < types.length; i++) {
        if (results[i]) {
            map[types[i]] = {
                date: results[i]!.date,
                data: results[i]!.data,
                source: results[i]!.source,
            };
        }
    }
    return map;
}

/**
 * Build device context summary for insight engine.
 * Returns a text block summarizing recent device signals for LLM prompts.
 */
export async function buildDeviceContextForInsights(
    userId: string,
    days: number = 14
): Promise<string | null> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const signals = await prisma.deviceSignal.findMany({
        where: { userId, date: { gte: stripTime(since) } },
        orderBy: { date: 'asc' },
    });

    if (signals.length === 0) return null;

    const lines: string[] = [];

    // Group by type
    const byType = new Map<string, typeof signals>();
    for (const s of signals) {
        const arr = byType.get(s.signalType) ?? [];
        arr.push(s);
        byType.set(s.signalType, arr);
    }

    // Location summaries
    const locations = byType.get('location_summary');
    if (locations && locations.length > 0) {
        const places = new Map<string, number>();
        for (const s of locations) {
            const d = s.data as unknown as LocationSummaryData;
            if (d.dominantPlace) places.set(d.dominantPlace, (places.get(d.dominantPlace) ?? 0) + 1);
        }
        const topPlaces = [...places.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
        lines.push(`Location context (${locations.length} days): Most frequent places: ${topPlaces.map(([p, c]) => `${p} (${c}d)`).join(', ')}`);
    }

    // Calendar busyness
    const calendar = byType.get('calendar');
    if (calendar && calendar.length > 0) {
        const avgEvents = calendar.reduce((s, c) => s + ((c.data as unknown as CalendarData).totalEvents || 0), 0) / calendar.length;
        const avgMeetingMins = calendar.reduce((s, c) => s + ((c.data as unknown as CalendarData).meetingMinutes || 0), 0) / calendar.length;
        lines.push(`Calendar busyness (${calendar.length} days): Avg ${avgEvents.toFixed(1)} events/day, ${Math.round(avgMeetingMins)} min in meetings/day`);
    }

    // Spotify
    const spotify = byType.get('spotify');
    if (spotify && spotify.length > 0) {
        const avgValence = spotify.reduce((s, c) => s + ((c.data as unknown as SpotifyData).avgValence || 0), 0) / spotify.length;
        const avgEnergy = spotify.reduce((s, c) => s + ((c.data as unknown as SpotifyData).avgEnergy || 0), 0) / spotify.length;
        const allGenres = new Set<string>();
        for (const s of spotify) {
            for (const g of ((s.data as unknown as SpotifyData).topGenres || [])) allGenres.add(g);
        }
        lines.push(`Music listening (${spotify.length} days): Avg valence ${(avgValence * 100).toFixed(0)}%, energy ${(avgEnergy * 100).toFixed(0)}%. Genres: ${[...allGenres].slice(0, 4).join(', ')}`);
    }

    // Digital wellness
    const screenTime = byType.get('screen_time');
    const wellness = byType.get('wellness_checkin');
    if (screenTime && screenTime.length > 0) {
        const avgMins = screenTime.reduce((s, c) => s + ((c.data as unknown as ScreenTimeData).totalMinutes || 0), 0) / screenTime.length;
        lines.push(`Screen time (${screenTime.length} days): Avg ${Math.round(avgMins / 60)}h ${Math.round(avgMins % 60)}m/day`);
    }
    if (wellness && wellness.length > 0) {
        const avgStress = wellness.reduce((s, c) => s + ((c.data as unknown as WellnessCheckinData).stressLevel || 0), 0) / wellness.length;
        const avgEnergy = wellness.reduce((s, c) => s + ((c.data as unknown as WellnessCheckinData).energyLevel || 0), 0) / wellness.length;
        lines.push(`Wellness check-ins (${wellness.length} days): Avg stress ${avgStress.toFixed(1)}/5, energy ${avgEnergy.toFixed(1)}/5`);
    }

    // App sessions
    const sessions = byType.get('app_session');
    if (sessions && sessions.length > 0) {
        const avgSessionMins = sessions.reduce((s, c) => s + ((c.data as unknown as AppSessionData).totalMinutes || 0), 0) / sessions.length;
        lines.push(`App usage (${sessions.length} days): Avg ${Math.round(avgSessionMins)} min/day in Notive`);
    }

    return lines.length > 0 ? lines.join('\n') : null;
}

// ── Helpers ──────────────────────────────────────────────────

function stripTime(date: Date): Date {
    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);
    return d;
}
