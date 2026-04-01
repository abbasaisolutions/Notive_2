import { PrismaClient } from '@prisma/client';
import { PushNotificationService } from './push-notification.service';

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
        const currentUtcDay = now.getUTCDay(); // 0=Sun

        const enabled = await this.prisma.reminder.findMany({
            where: { enabled: true },
        });

        let dispatched = 0;

        for (const reminder of enabled) {
            const [remHour, remMin] = reminder.time.split(':').map(Number);
            if (isNaN(remHour) || isNaN(remMin)) continue;

            // Convert reminder local time to UTC for comparison using the stored timezone.
            // For simplicity we approximate using JS Intl — works for standard IANA zones.
            const utcOffset = getUtcOffsetMinutes(reminder.timezone, now);
            const reminderUtcMinutes = (remHour * 60 + remMin - utcOffset + 1440) % 1440;
            const currentUtcMinutes = currentUtcHour * 60 + currentUtcMinute;

            if (reminderUtcMinutes !== currentUtcMinutes) continue;

            // Check day-of-week filter (in user's local timezone)
            if (reminder.days.length > 0) {
                const localDay = getLocalDayOfWeek(reminder.timezone, now);
                if (!reminder.days.includes(localDay)) continue;
            }

            await this.pushService.sendPushNotification(reminder.userId, {
                title: "Time to reflect 📓",
                body: "Take a moment to capture what's on your mind today.",
                data: { type: 'reminder', link: '/entry/new' },
            }).catch(() => {});

            dispatched++;
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
