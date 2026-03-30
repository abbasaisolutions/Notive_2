/**
 * Google Calendar Service
 *
 * Fetches calendar events to compute daily "busyness" context.
 * Uses the same Google OAuth infrastructure as Google Fit.
 * Requires scope: https://www.googleapis.com/auth/calendar.readonly
 *
 * Data captured per day:
 * - Total event count
 * - Meeting minutes
 * - Free time blocks
 * - Busiest hour
 */

import { OAuth2Client } from 'google-auth-library';
import { upsertSignal, type CalendarData } from './device-signal.service';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';
const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3';

type CalendarEvent = {
    id: string;
    summary?: string;
    start?: { dateTime?: string; date?: string };
    end?: { dateTime?: string; date?: string };
    status?: string;
};

type CalendarListResponse = {
    items?: CalendarEvent[];
    nextPageToken?: string;
};

/**
 * Fetch events for a single day and compute busyness metrics.
 */
export async function syncCalendarForDate(
    userId: string,
    accessToken: string,
    date: Date
): Promise<CalendarData | null> {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    try {
        const events = await fetchEvents(accessToken, dayStart, dayEnd);
        if (!events || events.length === 0) {
            const data: CalendarData = {
                totalEvents: 0,
                meetingMinutes: 0,
                freeBlocks: 8, // assume fully free
                busiestHour: null,
                categories: {},
            };
            await upsertSignal(userId, date, 'calendar', data as unknown as Record<string, unknown>, 'API');
            return data;
        }

        // Compute metrics
        let meetingMinutes = 0;
        const hourCounts = new Map<number, number>();
        const categories: Record<string, number> = {};

        for (const event of events) {
            if (event.status === 'cancelled') continue;

            const start = event.start?.dateTime ? new Date(event.start.dateTime) : null;
            const end = event.end?.dateTime ? new Date(event.end.dateTime) : null;

            if (start && end) {
                const duration = (end.getTime() - start.getTime()) / (1000 * 60);
                meetingMinutes += Math.min(duration, 480); // cap at 8 hours

                const hour = start.getHours();
                hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1);
            }

            // Categorize by summary keywords
            const summary = (event.summary || '').toLowerCase();
            if (/meeting|standup|sync|call|1:1/.test(summary)) {
                categories['meetings'] = (categories['meetings'] ?? 0) + 1;
            } else if (/class|lecture|lab|tutorial|seminar/.test(summary)) {
                categories['classes'] = (categories['classes'] ?? 0) + 1;
            } else if (/study|homework|assignment|exam|test|quiz/.test(summary)) {
                categories['study'] = (categories['study'] ?? 0) + 1;
            } else if (/gym|workout|practice|game|sport/.test(summary)) {
                categories['activity'] = (categories['activity'] ?? 0) + 1;
            } else {
                categories['other'] = (categories['other'] ?? 0) + 1;
            }
        }

        // Busiest hour
        let busiestHour: number | null = null;
        let maxCount = 0;
        for (const [hour, count] of hourCounts) {
            if (count > maxCount) { maxCount = count; busiestHour = hour; }
        }

        // Free blocks: count 1hr+ gaps in 8am-10pm range
        const busySlots = events
            .filter((e) => e.start?.dateTime && e.end?.dateTime && e.status !== 'cancelled')
            .map((e) => ({
                start: new Date(e.start!.dateTime!).getTime(),
                end: new Date(e.end!.dateTime!).getTime(),
            }))
            .sort((a, b) => a.start - b.start);

        let freeBlocks = 0;
        let cursor = dayStart.getTime() + 8 * 60 * 60 * 1000; // 8am
        const dayEndMs = dayStart.getTime() + 22 * 60 * 60 * 1000; // 10pm
        for (const slot of busySlots) {
            if (slot.start > cursor && (slot.start - cursor) >= 60 * 60 * 1000) {
                freeBlocks++;
            }
            cursor = Math.max(cursor, slot.end);
        }
        if (dayEndMs > cursor && (dayEndMs - cursor) >= 60 * 60 * 1000) {
            freeBlocks++;
        }

        const data: CalendarData = {
            totalEvents: events.filter((e) => e.status !== 'cancelled').length,
            meetingMinutes: Math.round(meetingMinutes),
            freeBlocks,
            busiestHour,
            categories,
        };

        await upsertSignal(userId, date, 'calendar', data as unknown as Record<string, unknown>, 'API');
        return data;
    } catch (error) {
        console.error('Calendar sync error:', error);
        return null;
    }
}

/**
 * Fetch events from Google Calendar API.
 */
async function fetchEvents(
    accessToken: string,
    timeMin: Date,
    timeMax: Date
): Promise<CalendarEvent[]> {
    const params = new URLSearchParams({
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        singleEvents: 'true',
        orderBy: 'startTime',
        maxResults: '100',
    });

    const response = await fetch(
        `${CALENDAR_API_BASE}/calendars/primary/events?${params}`,
        {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/json',
            },
        }
    );

    if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Calendar API ${response.status}: ${text}`);
    }

    const data: CalendarListResponse = await response.json();
    return data.items ?? [];
}

/**
 * Generate the Google Calendar OAuth URL.
 * Uses incremental auth — adds calendar scope to existing Google scopes.
 */
export function getCalendarAuthUrl(state: string): string {
    const oauth2Client = new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
    return oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: [CALENDAR_SCOPE],
        state,
        include_granted_scopes: true, // incremental authorization
        prompt: 'consent',
    });
}

export { CALENDAR_SCOPE };
