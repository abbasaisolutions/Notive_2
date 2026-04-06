import { PrismaClient } from '@prisma/client';

// ── Types ────────────────────────────────────────────────────────────────────

export type TimeOfDay = 'morning' | 'afternoon' | 'evening';

interface NotificationCopy {
    title: string;
    body: string;
}

export interface UserNotificationContext {
    lastEntryAt: Date | null;
    daysSinceLastEntry: number | null;
    isConsistent: boolean; // 4+ entries in last 7 days
}

// ── Message Bank ─────────────────────────────────────────────────────────────
// Warm, lock-screen-safe, emoji-as-emotion. No gamification, no guilt.

const MESSAGE_BANK: Record<string, NotificationCopy[]> = {
    // ── Daily (0-1 day gap, standard tone) ────────────────────────────────
    daily_morning: [
        { title: 'Good morning \u{1F324}\uFE0F', body: "What's on your mind today?" },
        { title: 'Morning \u2600\uFE0F', body: 'How are you feeling?' },
        { title: 'Hey, early start \u2728', body: 'Got any thoughts to share?' },
        { title: 'New day \u2601\uFE0F', body: 'What are we thinking today?' },
        { title: 'Rise and write \u{1F305}', body: 'Even one sentence counts' },
        { title: 'Morning check-in \u{1F4AD}', body: "How's the day looking?" },
    ],
    daily_afternoon: [
        { title: 'Hey \u{1F4AD}', body: "How's your day going?" },
        { title: 'Quick check-in \u2728', body: "What's been on your mind?" },
        { title: 'Afternoon pause \u2601\uFE0F', body: 'Take a sec for yourself' },
        { title: 'Hey there \u{1F4AC}', body: "How's the afternoon?" },
        { title: 'Midday thoughts \u{1F4AD}', body: 'Anything worth noting?' },
        { title: 'Breather? \u2728', body: "What's happening today?" },
    ],
    daily_evening: [
        { title: 'Good evening \u{1F319}', body: "How'd today go?" },
        { title: 'Winding down \u{1F4AD}', body: 'Tell me one thing about today' },
        { title: 'Evening check-in \u{1F319}', body: 'How are you feeling tonight?' },
        { title: 'End of day \u2728', body: 'What stood out today?' },
        { title: 'Before bed \u{1F319}', body: 'Anything on your mind?' },
        { title: 'Night thoughts \u2601\uFE0F', body: 'Reflect on today for a sec?' },
    ],

    // ── Daily consistent (4+ entries in last 7 days — warmer) ─────────────
    daily_consistent_morning: [
        { title: 'Morning again \u2600\uFE0F', body: 'Love that you keep showing up' },
        { title: 'Hey you \u{1F324}\uFE0F', body: 'Ready for another one?' },
        { title: 'Back at it \u2728', body: "What's today looking like?" },
    ],
    daily_consistent_afternoon: [
        { title: 'You again \u2601\uFE0F', body: 'Tell me about today' },
        { title: 'Right on time \u{1F4AD}', body: "What's on your mind?" },
        { title: 'Here you are \u2728', body: "How's it going?" },
    ],
    daily_consistent_evening: [
        { title: 'Hey, welcome back \u{1F319}', body: 'How was today?' },
        { title: 'Another day done \u2728', body: 'What stood out?' },
        { title: 'You showed up \u{1F4AD}', body: "How'd it go?" },
    ],

    // ── Missing you (2-3 day gap) ─────────────────────────────────────────
    missing_you: [
        { title: 'Hey, been a few days \u{1F4AD}', body: 'How have you been?' },
        { title: 'Checking in \u2728', body: "Haven't heard from you" },
        { title: 'Still here \u{1F90D}', body: "Whenever you're ready" },
        { title: 'Hey \u{1F4AC}', body: 'Just a gentle nudge' },
        { title: 'Thinking of you \u2601\uFE0F', body: 'Drop in when you can' },
        { title: 'Quick hello \u{1F90D}', body: 'Even one line is enough' },
    ],

    // ── Welcome back (4+ day gap) ─────────────────────────────────────────
    welcome_back: [
        { title: 'Hey \u{1F90D}', body: "It's been a while \u2014 no pressure" },
        { title: 'Saved your spot \u2728', body: "Pick up whenever you're ready" },
        { title: 'Still here for you \u{1F4AD}', body: 'No rush at all' },
        { title: 'Welcome back \u2601\uFE0F', body: 'Start fresh anytime' },
        { title: 'Hi again \u{1F90D}', body: 'One thought is all it takes' },
        { title: 'Your space is here \u2728', body: 'Whenever feels right' },
    ],

    // ── First hello (no entries ever) ─────────────────────────────────────
    first_hello: [
        { title: "Hey, it's Notive \u2728", body: "What's on your mind?" },
        { title: 'Your page is ready \u{1F90D}', body: 'Start with just one thought' },
        { title: 'Welcome \u2601\uFE0F', body: 'Tell me anything' },
        { title: 'First entry? \u2728', body: 'No rules \u2014 just your words' },
        { title: 'Ready when you are \u{1F4AD}', body: 'One sentence to start' },
    ],
};

// ── Pure Functions ───────────────────────────────────────────────────────────

/** Parse reminder HH:MM → time-of-day bucket. */
export function resolveTimeOfDay(reminderTime: string): TimeOfDay {
    const hour = parseInt(reminderTime.split(':')[0], 10);
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    return 'evening';
}

/** Determine the notification category from user context. Priority order wins. */
export function resolveCategory(
    daysSinceLastEntry: number | null,
    isConsistent: boolean,
    timeOfDay: TimeOfDay,
): string {
    if (daysSinceLastEntry === null) return 'first_hello';
    if (daysSinceLastEntry >= 4) return 'welcome_back';
    if (daysSinceLastEntry >= 2) return 'missing_you';
    if (isConsistent) return `daily_consistent_${timeOfDay}`;
    return `daily_${timeOfDay}`;
}

/** Deterministic hash — same user+day+category always picks the same message. */
function hashKey(value: string): number {
    let hash = 5381;
    for (let i = 0; i < value.length; i++) {
        hash = ((hash << 5) + hash) ^ value.charCodeAt(i);
    }
    return Math.abs(hash);
}

/** Pick a notification deterministically (no repeats on the same day). */
export function selectNotification(
    category: string,
    userId: string,
    localDate: string,
): NotificationCopy {
    const pool = MESSAGE_BANK[category] ?? MESSAGE_BANK['daily_morning'];
    const index = hashKey(`${userId}:${localDate}:${category}`) % pool.length;
    return pool[index];
}

// ── Suppression ──────────────────────────────────────────────────────────────

/** True if user already has an entry today in their local timezone → skip send. */
export function shouldSuppress(lastEntryAt: Date | null, timezone: string): boolean {
    if (!lastEntryAt) return false;
    try {
        const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }); // YYYY-MM-DD
        const todayLocal = fmt.format(new Date());
        const entryLocal = fmt.format(lastEntryAt);
        return todayLocal === entryLocal;
    } catch {
        return false;
    }
}

/** Get local date string (YYYY-MM-DD) for a timezone. */
export function getLocalDate(timezone: string, now: Date): string {
    try {
        return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(now);
    } catch {
        return now.toISOString().slice(0, 10);
    }
}

// ── Batch Context Query ──────────────────────────────────────────────────────

/** Fetch last-entry date + 7-day count for a batch of users in one query. */
export async function buildUserContexts(
    prisma: PrismaClient,
    userIds: string[],
): Promise<Map<string, UserNotificationContext>> {
    const map = new Map<string, UserNotificationContext>();
    if (userIds.length === 0) return map;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const rows: Array<{
        userId: string;
        lastEntryAt: Date | null;
        recentCount: bigint;
    }> = await prisma.$queryRawUnsafe(
        `SELECT "userId",
                MAX("createdAt") as "lastEntryAt",
                COUNT(*) FILTER (WHERE "createdAt" > $2) as "recentCount"
         FROM "Entry"
         WHERE "userId" = ANY($1) AND "deletedAt" IS NULL
         GROUP BY "userId"`,
        userIds,
        sevenDaysAgo,
    );

    const now = new Date();
    for (const row of rows) {
        const daysSince = row.lastEntryAt
            ? Math.floor((now.getTime() - row.lastEntryAt.getTime()) / 86_400_000)
            : null;

        map.set(row.userId, {
            lastEntryAt: row.lastEntryAt,
            daysSinceLastEntry: daysSince,
            isConsistent: Number(row.recentCount) >= 4,
        });
    }

    // Users with zero entries won't appear in the GROUP BY — fill them in
    for (const uid of userIds) {
        if (!map.has(uid)) {
            map.set(uid, { lastEntryAt: null, daysSinceLastEntry: null, isConsistent: false });
        }
    }

    return map;
}
