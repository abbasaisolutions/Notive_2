import { PrismaClient, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PushNotificationService } from './push-notification.service';
import {
    shouldCreateNotificationForType,
    shouldSendPushForType,
} from './notification-preferences.service';
import { serverLogger } from '../utils/server-logger';

type NotificationData = Record<string, string | number | boolean | null>;

type OutboxPayload = {
    title: string;
    body: string;
    data?: NotificationData;
};

type EnqueueOptions = {
    type: string;
    scheduledFor?: Date;
    delayMs?: number;
    dedupeKey?: string;
};

type OutboxRow = {
    id: string;
    userId: string;
    type: string;
    title: string;
    body: string | null;
    data: Prisma.JsonValue | null;
    attemptCount: number;
};

const STORY_DISCOVERY_MIN_DELAY_MS = 3 * 60_000;
const STORY_DISCOVERY_MAX_DELAY_MS = 8 * 60_000;
const STORY_DISCOVERY_COOLDOWN_MS = 12 * 60 * 60_000;
const OUTBOX_BATCH_SIZE = 25;
const OUTBOX_MAX_ATTEMPTS = 3;

const STORY_NOTIFICATION_COPY = [
    {
        title: 'A story thread is ready',
        bodyPrefix: 'Notive found useful material in',
    },
    {
        title: 'A moment is ready to use',
        bodyPrefix: 'There is story material in',
    },
    {
        title: 'Something in your writing is worth revisiting',
        bodyPrefix: 'Notive noticed a thread in',
    },
] as const;

const LOW_URGENCY_TYPES = new Set([
    'portfolio_evidence',
    'insight',
    'insights',
    'insight_ready',
    'weekly_digest',
    're_engagement',
]);

const asRecord = (value: unknown): Record<string, unknown> | null =>
    value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : null;

const toJsonString = (data: NotificationData | undefined): string =>
    JSON.stringify(data ?? null);

const stableHash = (value: string): number => {
    let hash = 5381;
    for (let i = 0; i < value.length; i++) {
        hash = ((hash << 5) + hash) ^ value.charCodeAt(i);
    }
    return Math.abs(hash);
};

export const getStoryDiscoveryDelayMs = (userId: string, entryId: string): number => {
    const range = STORY_DISCOVERY_MAX_DELAY_MS - STORY_DISCOVERY_MIN_DELAY_MS;
    return STORY_DISCOVERY_MIN_DELAY_MS + (stableHash(`${userId}:${entryId}`) % (range + 1));
};

export const getStoryDiscoveryCopy = (userId: string, entryId: string, titleSnippet: string): OutboxPayload => {
    const variant = STORY_NOTIFICATION_COPY[stableHash(`${entryId}:${userId}:story-copy`) % STORY_NOTIFICATION_COPY.length];
    return {
        title: variant.title,
        body: `${variant.bodyPrefix} "${titleSnippet}".`,
        data: {
            type: 'portfolio_evidence',
            entryId,
            link: `/portfolio?highlight=${entryId}`,
        },
    };
};

export class NotificationOutboxService {
    private pushService: PushNotificationService;

    constructor(private prisma: PrismaClient) {
        this.pushService = new PushNotificationService(prisma);
    }

    async enqueuePush(userId: string, payload: OutboxPayload, options: EnqueueOptions): Promise<{ id: string | null; scheduledFor: Date }> {
        const scheduledFor = options.scheduledFor
            ?? new Date(Date.now() + Math.max(0, options.delayMs ?? 0));

        if (options.dedupeKey) {
            const existing = await this.findExistingOutbox(options.dedupeKey);
            if (existing) return { id: existing.id, scheduledFor: existing.scheduledFor };
        }

        const inserted = await this.prisma.$queryRaw<Array<{ id: string }>>`
            INSERT INTO "NotificationOutbox"
                ("id", "userId", "type", "title", "body", "data", "scheduledFor", "dedupeKey", "updatedAt")
            VALUES
                (${randomUUID()}, ${userId}, ${options.type}, ${payload.title}, ${payload.body}, ${toJsonString(payload.data)}::jsonb, ${scheduledFor}, ${options.dedupeKey ?? null}, NOW())
            ON CONFLICT ("dedupeKey") DO NOTHING
            RETURNING "id"
        `;

        return { id: inserted[0]?.id ?? null, scheduledFor };
    }

    async enqueueStoryDiscovery(userId: string, entryId: string, titleSnippet: string): Promise<{ id: string | null; scheduledFor: Date }> {
        const payload = getStoryDiscoveryCopy(userId, entryId, titleSnippet);
        return this.enqueuePush(userId, payload, {
            type: 'portfolio_evidence',
            delayMs: getStoryDiscoveryDelayMs(userId, entryId),
            dedupeKey: `portfolio_evidence:${userId}:${entryId}`,
        });
    }

    async dispatchDue(limit = OUTBOX_BATCH_SIZE): Promise<{ sent: number; skipped: number; failed: number }> {
        const jobs = await this.fetchDueJobs(limit);
        let sent = 0;
        let skipped = 0;
        let failed = 0;

        for (const job of jobs) {
            await this.markAttempt(job.id);
            try {
                const result = await this.dispatchJob(job);
                if (result === 'sent') sent++;
                if (result === 'skipped') skipped++;
            } catch (error) {
                failed++;
                await this.markFailed(job, error);
            }
        }

        return { sent, skipped, failed };
    }

    private async dispatchJob(job: OutboxRow): Promise<'sent' | 'skipped'> {
        const user = await this.prisma.user.findUnique({
            where: { id: job.userId },
            select: {
                profile: {
                    select: { personalizationSignals: true },
                },
            },
        });

        const signals = user?.profile?.personalizationSignals ?? null;
        if (!user || !shouldCreateNotificationForType(signals, job.type)) {
            await this.markSkipped(job.id, 'preference_disabled');
            return 'skipped';
        }

        if (await this.shouldCooldown(job)) {
            await this.markSkipped(job.id, 'cooldown');
            return 'skipped';
        }

        const data = asRecord(job.data) ?? {};
        const notification = await this.prisma.inAppNotification.create({
            data: {
                userId: job.userId,
                type: job.type,
                title: job.title,
                body: job.body,
                data: data as Prisma.InputJsonValue,
            },
            select: { id: true },
        });

        if (shouldSendPushForType(signals, job.type)) {
            const pushData = Object.fromEntries(
                Object.entries({
                    ...data,
                    type: job.type,
                    notificationId: notification.id,
                }).map(([key, value]) => [key, String(value ?? '')])
            );

            await this.pushService.sendPushNotification(job.userId, {
                title: job.title,
                body: job.body ?? '',
                data: pushData,
            });
        }

        await this.markSent(job.id);
        return 'sent';
    }

    private async shouldCooldown(job: OutboxRow): Promise<boolean> {
        if (!LOW_URGENCY_TYPES.has(job.type)) return false;

        const cutoff = new Date(Date.now() - STORY_DISCOVERY_COOLDOWN_MS);
        const recent = await this.prisma.inAppNotification.findFirst({
            where: {
                userId: job.userId,
                type: { in: Array.from(LOW_URGENCY_TYPES) },
                createdAt: { gte: cutoff },
            },
            select: { id: true },
        });

        return Boolean(recent);
    }

    private async findExistingOutbox(dedupeKey: string): Promise<{ id: string; scheduledFor: Date } | null> {
        const rows = await this.prisma.$queryRaw<Array<{ id: string; scheduledFor: Date }>>`
            SELECT "id", "scheduledFor"
            FROM "NotificationOutbox"
            WHERE "dedupeKey" = ${dedupeKey}
            LIMIT 1
        `;
        return rows[0] ?? null;
    }

    private async fetchDueJobs(limit: number): Promise<OutboxRow[]> {
        return this.prisma.$queryRaw<OutboxRow[]>`
            SELECT "id", "userId", "type", "title", "body", "data", "attemptCount"
            FROM "NotificationOutbox"
            WHERE "status" = 'pending' AND "scheduledFor" <= NOW()
            ORDER BY "scheduledFor" ASC
            LIMIT ${limit}
        `;
    }

    private async markAttempt(id: string): Promise<void> {
        await this.prisma.$executeRaw`
            UPDATE "NotificationOutbox"
            SET "status" = 'processing',
                "attemptCount" = "attemptCount" + 1,
                "lastAttemptAt" = NOW(),
                "updatedAt" = NOW()
            WHERE "id" = ${id} AND "status" = 'pending'
        `;
    }

    private async markSent(id: string): Promise<void> {
        await this.prisma.$executeRaw`
            UPDATE "NotificationOutbox"
            SET "status" = 'sent', "updatedAt" = NOW()
            WHERE "id" = ${id}
        `;
    }

    private async markSkipped(id: string, reason: string): Promise<void> {
        await this.prisma.$executeRaw`
            UPDATE "NotificationOutbox"
            SET "status" = 'skipped', "lastError" = ${reason}, "updatedAt" = NOW()
            WHERE "id" = ${id}
        `;
    }

    private async markFailed(job: OutboxRow, error: unknown): Promise<void> {
        const message = error instanceof Error ? error.message : String(error);
        const nextStatus = job.attemptCount + 1 >= OUTBOX_MAX_ATTEMPTS ? 'failed' : 'pending';

        await this.prisma.$executeRaw`
            UPDATE "NotificationOutbox"
            SET "status" = ${nextStatus},
                "lastError" = ${message.slice(0, 1000)},
                "scheduledFor" = ${new Date(Date.now() + 5 * 60_000)},
                "updatedAt" = NOW()
            WHERE "id" = ${job.id}
        `;

        serverLogger.warn('notification_outbox.dispatch_failed', {
            id: job.id,
            type: job.type,
            userId: job.userId,
            nextStatus,
            message,
        });
    }
}

export default NotificationOutboxService;
