import { PrismaClient } from '@prisma/client';
import { PushNotificationService } from './push-notification.service';
import {
    buildUserContexts,
    shouldSuppress,
    resolveTimeOfDay,
    resolveCategory,
    selectNotification,
    getLocalDate,
} from './notification-copy';
import {
    shouldCreateNotificationForType,
    shouldSendPushForType,
} from './notification-preferences.service';
import { emailService } from './email.service';
import { generateWeeklyDigest } from './insight-engine.service';

export interface ReminderInput {
    time: string;            // "HH:MM" 24-hour
    days: number[];          // 0=Sun … 6=Sat; empty = every day
    timezone: string;
    enabled: boolean;
}

export interface ReminderRecord extends ReminderInput {
    id: string;
    userId: string;
    createdAt: Date;
    updatedAt: Date;
}

export class ReminderService {
    private pushService: PushNotificationService;

    constructor(private prisma: PrismaClient) {
        this.pushService = new PushNotificationService(prisma);
    }

    /** Get the reminder for a user (one per user — upsert model). */
    async getReminder(userId: string): Promise<ReminderRecord | null> {
        return this.prisma.reminder.findFirst({
            where: { userId },
            orderBy: { createdAt: 'asc' },
        }) as Promise<ReminderRecord | null>;
    }

    /** Create or update the reminder for a user. */
    async upsertReminder(userId: string, input: ReminderInput): Promise<ReminderRecord> {
        const existing = await this.prisma.reminder.findFirst({
            where: { userId },
            orderBy: { createdAt: 'asc' },
            select: { id: true },
        });

        if (existing) {
            return this.prisma.reminder.update({
                where: { id: existing.id },
                data: {
                    time: input.time,
                    days: input.days,
                    timezone: input.timezone,
                    enabled: input.enabled,
                },
            }) as Promise<ReminderRecord>;
        }

        return this.prisma.reminder.create({
            data: {
                userId,
                time: input.time,
                days: input.days,
                timezone: input.timezone,
                enabled: input.enabled,
            },
        }) as Promise<ReminderRecord>;
    }

    /** Delete the reminder for a user. */
    async deleteReminder(userId: string): Promise<void> {
        await this.prisma.reminder.deleteMany({ where: { userId } });
    }

    /**
     * Check and dispatch due reminders.
     * Called every minute by the scheduler in app startup.
     */
    async dispatchDueReminders(): Promise<{ dispatched: number }> {
        const now = new Date();
        const currentUtcHour = now.getUTCHours();
        const currentUtcMinute = now.getUTCMinutes();

        const enabled = await this.prisma.reminder.findMany({
            where: { enabled: true },
        });

        let dispatched = 0;

        // Phase 1: collect due reminders (time + day-of-week match)
        const dueReminders: ReminderRecord[] = [];
        for (const reminder of enabled) {
            const [remHour, remMin] = reminder.time.split(':').map(Number);
            if (isNaN(remHour) || isNaN(remMin)) continue;

            const utcOffset = getUtcOffsetMinutes(reminder.timezone, now);
            const reminderUtcMinutes = (remHour * 60 + remMin - utcOffset + 1440) % 1440;
            const currentUtcMinutes = currentUtcHour * 60 + currentUtcMinute;

            if (reminderUtcMinutes !== currentUtcMinutes) continue;

            if (reminder.days.length > 0) {
                const localDay = getLocalDayOfWeek(reminder.timezone, now);
                if (!reminder.days.includes(localDay)) continue;
            }

            dueReminders.push(reminder);
        }

        if (dueReminders.length === 0) return { dispatched: 0 };

        // Phase 2: batch-query user context (last entry, 7-day count)
        const userIds = dueReminders.map(r => r.userId);
        const contexts = await buildUserContexts(this.prisma, userIds);
        const users = await this.prisma.user.findMany({
            where: { id: { in: userIds } },
            select: {
                id: true,
                profile: {
                    select: { personalizationSignals: true },
                },
            },
        });
        const signalsByUserId = new Map(
            users.map((user) => [user.id, user.profile?.personalizationSignals ?? null])
        );

        // Phase 3: send context-aware notifications
        for (const reminder of dueReminders) {
            const ctx = contexts.get(reminder.userId) ?? {
                lastEntryAt: null,
                daysSinceLastEntry: null,
                isConsistent: false,
            };
            const userSignals = signalsByUserId.get(reminder.userId);

            // Skip if user already journaled today
            if (shouldSuppress(ctx.lastEntryAt, reminder.timezone)) continue;
            if (!shouldCreateNotificationForType(userSignals, 'reminder')) continue;

            const timeOfDay = resolveTimeOfDay(reminder.time);
            let category = resolveCategory(ctx.daysSinceLastEntry, ctx.isConsistent, timeOfDay);

            // Streak-at-risk override: user wrote yesterday (streak alive) but not today
            // Only fire between 8–10 PM local time to avoid over-notifying
            if (ctx.daysSinceLastEntry === 1) {
                const localHour = getLocalHour(reminder.timezone, now);
                if (localHour >= 20 && localHour < 22) {
                    const streak = await getUserStreak(reminder.userId, this.prisma, reminder.timezone);
                    if (streak >= 2) {
                        category = 'streak_at_risk';
                    }
                }
            }
            const localDate = getLocalDate(reminder.timezone, now);
            const dispatchKey = `${reminder.id}:${localDate}:${reminder.time}`;
            const copy = selectNotification(category, reminder.userId, localDate);
            const existingNotification = await this.prisma.inAppNotification.findFirst({
                where: {
                    userId: reminder.userId,
                    type: 'reminder',
                    data: {
                        path: ['dispatchKey'],
                        equals: dispatchKey,
                    },
                },
                select: { id: true },
            });

            if (existingNotification) {
                continue;
            }

            const notification = await this.prisma.inAppNotification.create({
                data: {
                    userId: reminder.userId,
                    type: 'reminder',
                    title: copy.title,
                    body: copy.body,
                    data: {
                        category,
                        dispatchKey,
                        localDate,
                        link: '/entry/new?source=reminder',
                    },
                },
                select: { id: true },
            });
            dispatched++;

            const reminderLink = `/entry/new?source=reminder&notificationId=${notification.id}`;
            const shouldSendReminderPush = shouldSendPushForType(userSignals, 'reminder');

            const result = shouldSendReminderPush
                ? await this.pushService.sendPushNotification(reminder.userId, {
                    title: copy.title,
                    body: copy.body,
                    data: {
                        type: 'reminder',
                        link: reminderLink,
                        notificationId: notification.id,
                    },
                }).catch(() => null)
                : null;

            if (shouldSendReminderPush && (result?.failed ?? 0) > 0 && result?.sent === 0) {
                // All tokens failed (dead/expired) — remove orphan in-app notification
                // since there's no way the user will see a push for it.
                // If sent===0 AND failed===0 (no tokens at all), keep the in-app
                // notification as a fallback for when the user opens the app.
                await this.prisma.inAppNotification.delete({
                    where: { id: notification.id },
                }).catch(() => {});
                dispatched = Math.max(0, dispatched - 1);
            }
        }

        return { dispatched };
    }

    /**
     * Dispatch weekly digest emails on Sunday at 7 PM local time.
     * Called every minute by the scheduler alongside dispatchDueReminders().
     */
    async dispatchWeeklyDigests(): Promise<{ sent: number }> {
        const now = new Date();
        let sent = 0;

        // Only users with reminders (we use their timezone)
        const reminders = await this.prisma.reminder.findMany({
            where: { enabled: true },
            select: { userId: true, timezone: true },
        });

        for (const reminder of reminders) {
            const localDay = getLocalDayOfWeek(reminder.timezone, now);
            const localHour = getLocalHour(reminder.timezone, now);

            // Sunday at 7 PM local
            if (localDay !== 0 || localHour !== 19) continue;

            // Prevent duplicate digest in the same week
            const weekKey = getLocalDate(reminder.timezone, now);
            const existing = await this.prisma.inAppNotification.findFirst({
                where: {
                    userId: reminder.userId,
                    type: 'weekly_digest',
                    data: { path: ['weekKey'], equals: weekKey },
                },
                select: { id: true },
            });
            if (existing) continue;

            try {
                const userWithProfile = await this.prisma.user.findUnique({
                    where: { id: reminder.userId },
                    include: { profile: { select: { personalizationSignals: true } } },
                });
                if (!userWithProfile) continue;

                const signals = userWithProfile.profile?.personalizationSignals ?? null;
                if (!shouldCreateNotificationForType(signals, 'weekly_digest')) continue;

                const digest = await generateWeeklyDigest(reminder.userId);
                if (!digest) continue;

                await emailService.sendWeeklyDigest(userWithProfile, digest).catch(() => {});

                await this.prisma.inAppNotification.create({
                    data: {
                        userId: reminder.userId,
                        type: 'weekly_digest',
                        title: `Your week: ${digest.title}`,
                        body: digest.highlights[0]?.insight ?? 'Your weekly summary is ready.',
                        data: {
                            weekKey,
                            link: '/dashboard',
                        },
                    },
                });

                if (shouldSendPushForType(signals, 'weekly_digest')) {
                    await this.pushService.sendPushNotification(reminder.userId, {
                        title: `Your week: ${digest.title}`,
                        body: digest.highlights[0]?.insight ?? 'Your weekly summary is ready.',
                        data: { type: 'weekly_digest', link: '/dashboard' },
                    }).catch(() => null);
                }

                sent++;
            } catch {
                // Non-critical — skip user
            }
        }

        return { sent };
    }

    /**
     * Send re-engagement emails to users inactive 7-21 days.
     * Only runs on Sunday between 17:00-18:00 UTC to avoid daily spam.
     */
    async dispatchReEngagementEmails(): Promise<{ sent: number }> {
        const now = new Date();
        if (now.getUTCDay() !== 0 || now.getUTCHours() !== 17) {
            return { sent: 0 };
        }

        let sent = 0;

        const cutoff7 = new Date();
        cutoff7.setDate(cutoff7.getDate() - 7);
        const cutoff21 = new Date();
        cutoff21.setDate(cutoff21.getDate() - 21);

        // Find users whose most recent entry is between 7 and 21 days old
        const candidates: Array<{ userId: string; lastEntry: Date; entryCount: bigint }> =
            await this.prisma.$queryRawUnsafe(
                `SELECT "userId",
                        MAX("createdAt") as "lastEntry",
                        COUNT(*) as "entryCount"
                 FROM "Entry"
                 WHERE "deletedAt" IS NULL
                 GROUP BY "userId"
                 HAVING MAX("createdAt") BETWEEN $1 AND $2`,
                cutoff21,
                cutoff7,
            );

        for (const candidate of candidates) {
            const daysSince = Math.floor(
                (Date.now() - candidate.lastEntry.getTime()) / 86_400_000,
            );

            // Check we haven't emailed this user recently (within 7 days)
            const recentEmail = await this.prisma.inAppNotification.findFirst({
                where: {
                    userId: candidate.userId,
                    type: 're_engagement',
                    createdAt: { gte: cutoff7 },
                },
                select: { id: true },
            });
            if (recentEmail) continue;

            try {
                const user = await this.prisma.user.findUnique({
                    where: { id: candidate.userId },
                    include: { profile: { select: { personalizationSignals: true } } },
                });
                if (!user) continue;
                const signals = user.profile?.personalizationSignals ?? null;
                if (!shouldCreateNotificationForType(signals, 're_engagement')) continue;

                await emailService.sendReEngagementEmail(user, {
                    entryCount: Number(candidate.entryCount),
                    daysSince,
                }).catch(() => {});

                // Track so we don't re-send
                await this.prisma.inAppNotification.create({
                    data: {
                        userId: candidate.userId,
                        type: 're_engagement',
                        title: 'Your notes are still here',
                        body: `It's been ${daysSince} days since your last entry.`,
                        data: { daysSince, link: '/entry/new?source=reengagement' },
                    },
                });

                sent++;
            } catch {
                // Non-critical
            }
        }

        return { sent };
    }
}

/** Returns the IANA-zone UTC offset in minutes for a given Date. */
function getUtcOffsetMinutes(timezone: string, date: Date): number {
    try {
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            hour: 'numeric',
            minute: 'numeric',
            hour12: false,
        });
        const parts = formatter.formatToParts(date);
        const localHour = Number(parts.find(p => p.type === 'hour')?.value ?? 0);
        const localMinute = Number(parts.find(p => p.type === 'minute')?.value ?? 0);
        const utcHour = date.getUTCHours();
        const utcMinute = date.getUTCMinutes();
        return (localHour * 60 + localMinute) - (utcHour * 60 + utcMinute);
    } catch {
        return 0;
    }
}

/** Returns the local day of week (0=Sun) for the given timezone. */
function getLocalDayOfWeek(timezone: string, date: Date): number {
    try {
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            weekday: 'short',
        });
        const day = formatter.format(date);
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return days.indexOf(day);
    } catch {
        return date.getUTCDay();
    }
}

/** Returns the local hour (0-23) for the given timezone. */
function getLocalHour(timezone: string, date: Date): number {
    try {
        const parts = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            hour: 'numeric',
            hour12: false,
        }).formatToParts(date);
        return Number(parts.find(p => p.type === 'hour')?.value ?? 0);
    } catch {
        return date.getUTCHours();
    }
}

/**
 * Count consecutive days with entries, ending yesterday in user's local timezone.
 * Returns 0 if user didn't write yesterday.
 */
async function getUserStreak(userId: string, prisma: PrismaClient, timezone: string): Promise<number> {
    const entries = await prisma.entry.findMany({
        where: { userId, deletedAt: null },
        select: { createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 60,
    });

    if (entries.length === 0) return 0;

    // Group entry dates by local date in user's timezone
    const fmt = (() => {
        try {
            return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }); // YYYY-MM-DD
        } catch {
            return new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC' });
        }
    })();

    const dates = new Set(entries.map(e => fmt.format(e.createdAt)));

    // Walk backward from yesterday in local time
    const now = new Date();
    const todayLocal = fmt.format(now);
    // Construct yesterday by parsing today and subtracting
    let streak = 0;
    const cursor = new Date(todayLocal + 'T12:00:00Z'); // noon UTC of local date to avoid boundary issues
    cursor.setUTCDate(cursor.getUTCDate() - 1); // yesterday local

    while (dates.has(fmt.format(cursor))) {
        streak++;
        cursor.setUTCDate(cursor.getUTCDate() - 1);
    }

    return streak;
}
