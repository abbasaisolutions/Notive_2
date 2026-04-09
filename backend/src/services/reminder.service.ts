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

        // Phase 3: send context-aware notifications
        for (const reminder of dueReminders) {
            const ctx = contexts.get(reminder.userId) ?? {
                lastEntryAt: null,
                daysSinceLastEntry: null,
                isConsistent: false,
            };

            // Skip if user already journaled today
            if (shouldSuppress(ctx.lastEntryAt, reminder.timezone)) continue;

            const timeOfDay = resolveTimeOfDay(reminder.time);
            const category = resolveCategory(ctx.daysSinceLastEntry, ctx.isConsistent, timeOfDay);
            const localDate = getLocalDate(reminder.timezone, now);
            const copy = selectNotification(category, reminder.userId, localDate);

            const notification = await this.prisma.inAppNotification.create({
                data: {
                    userId: reminder.userId,
                    type: 'reminder',
                    title: copy.title,
                    body: copy.body,
                    data: {
                        category,
                        localDate,
                        route: '/entry/new?source=reminder',
                    },
                },
                select: { id: true },
            });

            const reminderLink = `/entry/new?source=reminder&notificationId=${notification.id}`;

            const result = await this.pushService.sendPushNotification(reminder.userId, {
                title: copy.title,
                body: copy.body,
                data: {
                    type: 'reminder',
                    link: reminderLink,
                    route: reminderLink,
                    notificationId: notification.id,
                },
            }).catch(() => null);

            if ((result?.sent ?? 0) > 0) {
                dispatched++;
            } else {
                await this.prisma.inAppNotification.delete({
                    where: { id: notification.id },
                }).catch(() => {});
            }
        }

        return { dispatched };
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
