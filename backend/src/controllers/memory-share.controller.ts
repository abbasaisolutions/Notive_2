import { MemoryShareAccessStatus, Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { PushNotificationService } from '../services/push-notification.service';

const pushService = new PushNotificationService(prisma);
const SEARCH_SHARE_STATE_NONE = 'NONE' as const;
const SHARED_NOTIFICATION_TYPES = [
    'shared_memory',
    'memory_share_request',
    'memory_share_request_accepted',
    'memory_share_request_declined',
    'shared_memory_response',
    'share_reaction',
] as const;

const REACTION_DISPLAY: Record<string, { emoji: string; label: string }> = {
    grateful: { emoji: '🤝', label: 'Grateful' },
    inspired: { emoji: '✨', label: 'Inspired' },
    understood: { emoji: '💛', label: 'Understood' },
};

const maskEmail = (email: string) => {
    const [local, domain] = email.split('@');
    if (!local || !domain) return '***';
    return `${local[0]}***@${domain}`;
};

const formatCountLabel = (count: number) => `${count} ${count === 1 ? 'memory' : 'memories'}`;

const isMissingUserBlockTableError = (error: unknown) => {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
        return false;
    }

    if (error.code !== 'P2021') {
        return false;
    }

    const modelName = typeof error.meta?.modelName === 'string' ? error.meta.modelName : '';
    const table = typeof error.meta?.table === 'string' ? error.meta.table : '';

    return modelName === 'UserBlock' || table.includes('UserBlock');
};

const buildShareStateMap = async (senderId: string, recipientIds: string[]) => {
    if (recipientIds.length === 0) {
        return new Map<string, MemoryShareAccessStatus>();
    }

    const accessRows = await prisma.memoryShareAccess.findMany({
        where: {
            senderId,
            recipientId: { in: recipientIds },
        },
        select: {
            recipientId: true,
            status: true,
        },
    });

    return new Map(accessRows.map((row) => [row.recipientId, row.status]));
};

const getBlockedCounterpartIds = async (userId: string, candidateIds?: string[]) => {
    try {
        const blocks = await prisma.userBlock.findMany({
            where: {
                OR: [
                    {
                        blockerId: userId,
                        ...(candidateIds ? { blockedId: { in: candidateIds } } : {}),
                    },
                    {
                        blockedId: userId,
                        ...(candidateIds ? { blockerId: { in: candidateIds } } : {}),
                    },
                ],
            },
            select: { blockerId: true, blockedId: true },
        });

        return blocks.map((block) => (
            block.blockerId === userId ? block.blockedId : block.blockerId
        ));
    } catch (error) {
        if (isMissingUserBlockTableError(error)) {
            console.warn('UserBlock table missing; continuing without block filtering for memory share.');
            return [];
        }

        throw error;
    }
};

const normalizeStringIds = (value: unknown) => {
    if (!Array.isArray(value)) return [];

    return [...new Set(
        value
            .filter((item): item is string => typeof item === 'string')
            .map((item) => item.trim())
            .filter(Boolean),
    )];
};

/**
 * Search Notive users by name or email (for recipient picker).
 * GET /api/v1/memory-share/users/search?q=&limit=8
 */
export const searchUsers = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        const q = String(req.query.q || '').trim();
        const limit = Math.min(8, Math.max(1, Number(req.query.limit) || 8));

        if (q.length < 2) {
            return res.json({ users: [] });
        }

        const blockedIds = await getBlockedCounterpartIds(userId);

        const users = await prisma.user.findMany({
            where: {
                id: {
                    not: userId,
                    ...(blockedIds.length > 0 ? { notIn: blockedIds } : {}),
                },
                isBanned: false,
                OR: [
                    { name: { contains: q, mode: 'insensitive' } },
                    { email: { contains: q, mode: 'insensitive' } },
                ],
            },
            select: { id: true, name: true, avatarUrl: true, email: true },
            take: limit,
            orderBy: [
                { name: 'asc' },
                { email: 'asc' },
            ],
        });

        // Gracefully degrade if MemoryShareAccess table not yet migrated.
        let shareStateMap: Map<string, MemoryShareAccessStatus>;
        try {
            shareStateMap = await buildShareStateMap(userId, users.map((user) => user.id));
        } catch {
            shareStateMap = new Map();
        }

        return res.json({
            users: users.map((user) => ({
                id: user.id,
                name: user.name,
                avatarUrl: user.avatarUrl,
                email: maskEmail(user.email),
                shareState: shareStateMap.get(user.id) ?? SEARCH_SHARE_STATE_NONE,
            })),
        });
    } catch (error) {
        console.error('Search users error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * Recent distinct recipients that this user has shared with.
 * GET /api/v1/memory-share/users/recent?limit=5
 */
export const recentRecipients = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        const limit = Math.min(10, Math.max(1, Number(req.query.limit) || 5));

        const recipients = await prisma.sharedMemoryRecipient.findMany({
            where: {
                status: { not: MemoryShareAccessStatus.DECLINED },
                bundle: { senderId: userId, status: 'ACTIVE' },
            },
            select: {
                recipientId: true,
                createdAt: true,
                recipient: { select: { id: true, name: true, avatarUrl: true, email: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

        const seen = new Set<string>();
        const unique = recipients.filter((recipient) => {
            if (seen.has(recipient.recipientId)) return false;
            seen.add(recipient.recipientId);
            return true;
        }).slice(0, limit);

        const shareStateMap = await buildShareStateMap(
            userId,
            unique.map((recipient) => recipient.recipientId),
        );

        return res.json({
            users: unique.map((recipient) => ({
                id: recipient.recipient.id,
                name: recipient.recipient.name,
                avatarUrl: recipient.recipient.avatarUrl,
                email: maskEmail(recipient.recipient.email),
                shareState: shareStateMap.get(recipient.recipient.id) ?? SEARCH_SHARE_STATE_NONE,
            })),
        });
    } catch (error) {
        console.error('Recent recipients error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * Create a shared memory bundle.
 * First-time recipients receive a pending share request and must accept before
 * they can open the memories. Accepted sender/recipient pairs receive shares immediately.
 *
 * POST /api/v1/memory-share/bundles
 * Body: { entryIds: string[], recipientIds: string[], message?: string }
 */
export const createBundle = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        const entryIds = normalizeStringIds(req.body.entryIds);
        const recipientIds = normalizeStringIds(req.body.recipientIds);
        const message = typeof req.body.message === 'string' ? req.body.message : undefined;

        if (entryIds.length === 0 || entryIds.length > 10) {
            return res.status(400).json({ message: 'Provide 1-10 entry IDs' });
        }
        if (recipientIds.length === 0 || recipientIds.length > 5) {
            return res.status(400).json({ message: 'Provide 1-5 recipient IDs' });
        }
        if (message && message.length > 500) {
            return res.status(400).json({ message: 'Message must be 500 characters or fewer' });
        }
        if (recipientIds.includes(userId)) {
            return res.status(400).json({ message: 'Cannot share with yourself' });
        }

        const entries = await prisma.entry.findMany({
            where: { id: { in: entryIds }, userId, deletedAt: null },
            select: {
                id: true,
                title: true,
                content: true,
                mood: true,
                tags: true,
                coverImage: true,
                createdAt: true,
            },
        });

        if (entries.length !== entryIds.length) {
            return res.status(400).json({ message: 'One or more entries not found' });
        }

        const recipients = await prisma.user.findMany({
            where: { id: { in: recipientIds }, isBanned: false },
            select: { id: true, name: true },
        });

        if (recipients.length !== recipientIds.length) {
            return res.status(400).json({ message: 'One or more recipients not found' });
        }

        const blockedIds = new Set(await getBlockedCounterpartIds(userId, recipientIds));
        if (blockedIds.size > 0) {
            return res.status(403).json({ message: 'You cannot share with one or more selected users' });
        }

        let accessMap = new Map<string, MemoryShareAccessStatus>();
        try {
            const accessRows = await prisma.memoryShareAccess.findMany({
                where: {
                    senderId: userId,
                    recipientId: { in: recipientIds },
                },
                select: {
                    recipientId: true,
                    status: true,
                },
            });
            accessMap = new Map(accessRows.map((row) => [row.recipientId, row.status]));
        } catch {
            // MemoryShareAccess table may not be migrated yet; treat all as first-time.
        }

        const declinedRecipients = recipients.filter(
            (recipient) => accessMap.get(recipient.id) === MemoryShareAccessStatus.DECLINED,
        );
        if (declinedRecipients.length > 0) {
            const firstName = declinedRecipients[0]?.name || 'This user';
            return res.status(403).json({
                message: declinedRecipients.length === 1
                    ? `${firstName} isn't accepting memory shares from you right now`
                    : 'One or more selected people are not accepting memory shares from you right now',
            });
        }

        const sender = await prisma.user.findUnique({
            where: { id: userId },
            select: { name: true },
        });
        const senderName = sender?.name || 'Someone';
        const entryCount = entries.length;
        const noAccessRecipientIds = recipientIds.filter((recipientId) => !accessMap.has(recipientId));
        const acceptedRecipientIds = recipientIds.filter(
            (recipientId) => accessMap.get(recipientId) === MemoryShareAccessStatus.ACCEPTED,
        );
        const pendingRecipientIds = recipientIds.filter((recipientId) => (
            (accessMap.get(recipientId) ?? MemoryShareAccessStatus.PENDING) === MemoryShareAccessStatus.PENDING
        ));

        const bundle = await prisma.$transaction(async (tx) => {
            if (noAccessRecipientIds.length > 0) {
                await tx.memoryShareAccess.createMany({
                    data: noAccessRecipientIds.map((recipientId) => ({
                        senderId: userId,
                        recipientId,
                        status: MemoryShareAccessStatus.PENDING,
                    })),
                    skipDuplicates: true,
                });
            }

            // Supersede previous unread shares from this sender to the same
            // recipients. Only the recipient-level record is removed so other
            // recipients on the same bundle are unaffected.
            await tx.sharedMemoryRecipient.updateMany({
                where: {
                    recipientId: { in: recipientIds },
                    readAt: null,
                    bundle: {
                        senderId: userId,
                        status: 'ACTIVE',
                    },
                },
                data: { readAt: new Date(), status: MemoryShareAccessStatus.DECLINED },
            });

            const newBundle = await tx.sharedMemoryBundle.create({
                data: {
                    senderId: userId,
                    message: message?.trim() || null,
                    items: {
                        create: entries.map((entry, index) => ({
                            entryId: entry.id,
                            snapshotTitle: entry.title,
                            snapshotContent: entry.content,
                            snapshotMood: entry.mood,
                            snapshotTags: entry.tags,
                            snapshotCoverImage: entry.coverImage,
                            snapshotCreatedAt: entry.createdAt,
                            sortOrder: index,
                        })),
                    },
                    recipients: {
                        create: recipientIds.map((recipientId) => ({
                            recipientId,
                            status: accessMap.get(recipientId) === MemoryShareAccessStatus.ACCEPTED
                                ? MemoryShareAccessStatus.ACCEPTED
                                : MemoryShareAccessStatus.PENDING,
                        })),
                    },
                },
            });

            const notifications = [
                ...acceptedRecipientIds.map((recipientId) => ({
                    userId: recipientId,
                    type: 'shared_memory',
                    title: 'New shared memories',
                    body: `${senderName} shared ${formatCountLabel(entryCount)} with you`,
                    data: {
                        bundleId: newBundle.id,
                        senderId: userId,
                        senderName,
                        entryCount,
                        route: `/shared/view?id=${newBundle.id}`,
                    },
                })),
                ...pendingRecipientIds.map((recipientId) => ({
                    userId: recipientId,
                    type: 'memory_share_request',
                    title: 'New share request',
                    body: `${senderName} wants to share ${formatCountLabel(entryCount)} with you`,
                    data: {
                        bundleId: newBundle.id,
                        senderId: userId,
                        senderName,
                        entryCount,
                        route: '/timeline?view=shared',
                    },
                })),
            ];

            if (notifications.length > 0) {
                await tx.inAppNotification.createMany({ data: notifications });
            }

            return { newBundle, notifications };
        });

        // Build notificationId lookup for push payloads
        const inAppRows = bundle.notifications.length > 0
            ? await prisma.inAppNotification.findMany({
                where: {
                    type: { in: ['shared_memory', 'memory_share_request'] },
                    data: { path: ['bundleId'], equals: bundle.newBundle.id },
                },
                select: { id: true, userId: true },
            })
            : [];
        const notifIdByUser = new Map(inAppRows.map((r) => [r.userId, r.id]));

        for (const recipientId of acceptedRecipientIds) {
            pushService.sendPushNotification(recipientId, {
                title: 'New shared memories',
                body: `${senderName} shared ${formatCountLabel(entryCount)} with you`,
                data: {
                    type: 'shared_memory',
                    route: `/shared/view?id=${bundle.newBundle.id}`,
                    bundleId: bundle.newBundle.id,
                    ...(notifIdByUser.get(recipientId) ? { notificationId: notifIdByUser.get(recipientId)! } : {}),
                },
            }).catch((err) => console.error('Push notification failed:', err));
        }

        for (const recipientId of pendingRecipientIds) {
            pushService.sendPushNotification(recipientId, {
                title: 'New share request',
                body: `${senderName} wants to share ${formatCountLabel(entryCount)} with you`,
                data: {
                    type: 'memory_share_request',
                    route: '/timeline?view=shared',
                    bundleId: bundle.newBundle.id,
                    ...(notifIdByUser.get(recipientId) ? { notificationId: notifIdByUser.get(recipientId)! } : {}),
                },
            }).catch((err) => console.error('Push notification failed:', err));
        }

        return res.status(201).json({
            bundle: {
                id: bundle.newBundle.id,
                itemCount: entries.length,
                recipientCount: recipientIds.length,
                createdAt: bundle.newBundle.createdAt,
            },
            delivery: {
                acceptedCount: acceptedRecipientIds.length,
                pendingCount: pendingRecipientIds.length,
                recipientCount: recipientIds.length,
            },
        });
    } catch (error) {
        console.error('Create bundle error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * List bundles shared with me, including pending first-share requests.
 * Unread bundles appear first, followed by recently read bundles (last 30 days).
 * GET /api/v1/memory-share/received?page=1&limit=20
 */
export const listReceived = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const where = {
            recipientId: userId,
            status: {
                in: [
                    MemoryShareAccessStatus.PENDING,
                    MemoryShareAccessStatus.ACCEPTED,
                ],
            },
            bundle: { status: 'ACTIVE' as const },
            // Show unread bundles + read bundles from the last 30 days
            OR: [
                { readAt: null },
                { readAt: { gte: thirtyDaysAgo } },
            ],
        };

        const [records, total, pendingCount] = await Promise.all([
            prisma.sharedMemoryRecipient.findMany({
                where,
                // Unread first (nulls first), then by date
                orderBy: [{ readAt: 'desc' }, { createdAt: 'desc' }],
                skip: (page - 1) * limit,
                take: limit,
                include: {
                    bundle: {
                        include: {
                            sender: { select: { id: true, name: true, avatarUrl: true } },
                            items: {
                                select: {
                                    snapshotTitle: true,
                                    snapshotContent: true,
                                    snapshotMood: true,
                                    sortOrder: true,
                                },
                                orderBy: { sortOrder: 'asc' },
                                take: 1,
                            },
                            _count: { select: { items: true } },
                        },
                    },
                },
            }),
            prisma.sharedMemoryRecipient.count({ where }),
            prisma.sharedMemoryRecipient.count({
                where: {
                    recipientId: userId,
                    readAt: null,
                    status: MemoryShareAccessStatus.PENDING,
                    bundle: { status: 'ACTIVE' },
                },
            }),
        ]);

        const bundles = records.map((record) => ({
            bundleId: record.bundle.id,
            sender: record.bundle.sender,
            message: record.bundle.message,
            itemCount: record.bundle._count.items,
            firstItem: record.status === MemoryShareAccessStatus.ACCEPTED && record.bundle.items[0] ? {
                title: record.bundle.items[0].snapshotTitle,
                contentPreview: record.bundle.items[0].snapshotContent.slice(0, 120),
                mood: record.bundle.items[0].snapshotMood,
            } : null,
            readAt: record.readAt?.toISOString() ?? null,
            reaction: record.status === MemoryShareAccessStatus.ACCEPTED ? record.reaction : null,
            sharedAt: record.createdAt,
            status: record.status,
        }));

        return res.json({ bundles, total, pendingCount, page, limit });
    } catch (error) {
        console.error('List received error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * List bundles I sent, with recipient reactions.
 * GET /api/v1/memory-share/sent?page=1&limit=20
 */
export const listSent = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));

        const [bundles, total] = await Promise.all([
            prisma.sharedMemoryBundle.findMany({
                where: { senderId: userId, status: 'ACTIVE' },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
                include: {
                    items: {
                        select: { snapshotTitle: true, snapshotMood: true, sortOrder: true },
                        orderBy: { sortOrder: 'asc' },
                        take: 1,
                    },
                    _count: { select: { items: true } },
                    recipients: {
                        select: {
                            recipientId: true,
                            status: true,
                            readAt: true,
                            reaction: true,
                            recipient: { select: { id: true, name: true, avatarUrl: true } },
                        },
                    },
                },
            }),
            prisma.sharedMemoryBundle.count({
                where: { senderId: userId, status: 'ACTIVE' },
            }),
        ]);

        return res.json({
            bundles: bundles.map((bundle) => ({
                bundleId: bundle.id,
                itemCount: bundle._count.items,
                firstItemTitle: bundle.items[0]?.snapshotTitle ?? null,
                firstItemMood: bundle.items[0]?.snapshotMood ?? null,
                message: bundle.message,
                createdAt: bundle.createdAt,
                recipients: bundle.recipients.map((r) => ({
                    id: r.recipientId,
                    name: r.recipient.name,
                    avatarUrl: r.recipient.avatarUrl,
                    status: r.status,
                    readAt: r.readAt?.toISOString() ?? null,
                    reaction: r.reaction,
                })),
            })),
            total,
            page,
            limit,
        });
    } catch (error) {
        console.error('List sent error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * Respond to a sender's first-time share request.
 * PATCH /api/v1/memory-share/requests/:senderId/respond
 * Body: { decision: "ACCEPT" | "DECLINE" }
 */
export const respondToShareRequest = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        const { senderId } = req.params;
        const decision = String(req.body.decision || req.body.action || '').trim().toUpperCase();

        if (!senderId) {
            return res.status(400).json({ message: 'senderId is required' });
        }
        if (!['ACCEPT', 'DECLINE'].includes(decision)) {
            return res.status(400).json({ message: 'Decision must be ACCEPT or DECLINE' });
        }

        const access = await prisma.memoryShareAccess.findUnique({
            where: {
                senderId_recipientId: {
                    senderId,
                    recipientId: userId,
                },
            },
        });

        if (!access) {
            return res.status(404).json({ message: 'Share request not found' });
        }

        if (access.status !== MemoryShareAccessStatus.PENDING) {
            return res.status(409).json({
                message: 'This share request has already been handled',
                status: access.status,
            });
        }

        const nextStatus = decision === 'ACCEPT'
            ? MemoryShareAccessStatus.ACCEPTED
            : MemoryShareAccessStatus.DECLINED;

        const result = await prisma.$transaction(async (tx) => {
            const pendingBundleCount = await tx.sharedMemoryRecipient.count({
                where: {
                    recipientId: userId,
                    status: MemoryShareAccessStatus.PENDING,
                    bundle: {
                        senderId,
                        status: 'ACTIVE',
                    },
                },
            });

            await tx.memoryShareAccess.update({
                where: {
                    senderId_recipientId: {
                        senderId,
                        recipientId: userId,
                    },
                },
                data: {
                    status: nextStatus,
                    decidedAt: new Date(),
                },
            });

            // Bidirectional: when B accepts A's request, also grant B→A access
            // so B can share back without a separate approval flow.
            if (nextStatus === MemoryShareAccessStatus.ACCEPTED) {
                await tx.memoryShareAccess.upsert({
                    where: {
                        senderId_recipientId: {
                            senderId: userId,
                            recipientId: senderId,
                        },
                    },
                    create: {
                        senderId: userId,
                        recipientId: senderId,
                        status: MemoryShareAccessStatus.ACCEPTED,
                        decidedAt: new Date(),
                    },
                    update: {
                        status: MemoryShareAccessStatus.ACCEPTED,
                        decidedAt: new Date(),
                    },
                });
            }

            await tx.sharedMemoryRecipient.updateMany({
                where: {
                    recipientId: userId,
                    status: MemoryShareAccessStatus.PENDING,
                    bundle: {
                        senderId,
                        status: 'ACTIVE',
                    },
                },
                data: nextStatus === MemoryShareAccessStatus.ACCEPTED
                    ? {
                        status: MemoryShareAccessStatus.ACCEPTED,
                    }
                    : {
                        status: MemoryShareAccessStatus.DECLINED,
                        readAt: new Date(),
                        reaction: null,
                    },
            });

            const responder = await tx.user.findUnique({
                where: { id: userId },
                select: { name: true },
            });

            // Mark the incoming share-request notification as read so the badge clears.
            await tx.inAppNotification.updateMany({
                where: {
                    userId,
                    type: 'memory_share_request',
                    readAt: null,
                    data: {
                        path: ['senderId'],
                        equals: senderId,
                    },
                },
                data: { readAt: new Date() },
            });

            const responseNotification = await tx.inAppNotification.create({
                data: {
                    userId: senderId,
                    type: nextStatus === MemoryShareAccessStatus.ACCEPTED
                        ? 'memory_share_request_accepted'
                        : 'memory_share_request_declined',
                    title: nextStatus === MemoryShareAccessStatus.ACCEPTED
                        ? 'Share request accepted'
                        : 'Share request declined',
                    body: `${responder?.name || 'Someone'} ${nextStatus === MemoryShareAccessStatus.ACCEPTED ? 'can now see your shared memories' : 'declined your share request'}`,
                    data: {
                        recipientId: userId,
                        recipientName: responder?.name,
                        status: nextStatus,
                        pendingBundleCount,
                        route: '/timeline?view=shared',
                    },
                },
            });

            return {
                pendingBundleCount,
                responderName: responder?.name || 'Someone',
                notificationId: responseNotification.id,
            };
        });

        pushService.sendPushNotification(senderId, {
            title: nextStatus === MemoryShareAccessStatus.ACCEPTED
                ? 'Share request accepted'
                : 'Share request declined',
            body: nextStatus === MemoryShareAccessStatus.ACCEPTED
                ? `${result.responderName} can now see your shared memories`
                : `${result.responderName} declined your share request`,
            data: {
                type: 'shared_memory_response',
                route: '/timeline?view=shared',
                notificationId: result.notificationId,
            },
        }).catch((err) => console.error('Push notification failed:', err));

        return res.json({
            message: nextStatus === MemoryShareAccessStatus.ACCEPTED
                ? 'Share request accepted'
                : 'Share request declined',
            status: nextStatus,
            pendingBundleCount: result.pendingBundleCount,
        });
    } catch (error) {
        console.error('Respond to share request error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * Get full bundle detail.
 * GET /api/v1/memory-share/bundles/:id
 */
export const getBundleDetail = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        const { id } = req.params;

        const bundle = await prisma.sharedMemoryBundle.findUnique({
            where: { id },
            include: {
                sender: { select: { id: true, name: true, avatarUrl: true } },
                items: {
                    orderBy: { sortOrder: 'asc' },
                    select: {
                        id: true,
                        snapshotTitle: true,
                        snapshotContent: true,
                        snapshotMood: true,
                        snapshotTags: true,
                        snapshotCoverImage: true,
                        snapshotCreatedAt: true,
                        sortOrder: true,
                    },
                },
                recipients: {
                    select: {
                        recipientId: true,
                        status: true,
                        readAt: true,
                        reaction: true,
                        recipient: { select: { id: true, name: true, avatarUrl: true } },
                    },
                },
            },
        });

        if (!bundle) {
            return res.status(404).json({ message: 'Bundle not found' });
        }

        if (bundle.status === 'REVOKED') {
            return res.status(410).json({ message: 'This shared memory has been revoked' });
        }

        const isSender = bundle.sender.id === userId;
        const recipientRecord = bundle.recipients.find((recipient) => recipient.recipientId === userId);

        if (!isSender && !recipientRecord) {
            return res.status(403).json({ message: 'Access denied' });
        }

        if (recipientRecord && recipientRecord.status !== MemoryShareAccessStatus.ACCEPTED) {
            return res.status(403).json({ message: 'Accept this share request before viewing the memories' });
        }

        if (recipientRecord && !recipientRecord.readAt) {
            await prisma.$transaction([
                // Mark the SharedMemoryRecipient row as read
                prisma.sharedMemoryRecipient.updateMany({
                    where: {
                        bundleId: id,
                        recipientId: userId,
                        status: MemoryShareAccessStatus.ACCEPTED,
                    },
                    data: { readAt: new Date() },
                }),
                // Also mark the corresponding InAppNotification(s) as read
                // so the badge count clears immediately.
                prisma.inAppNotification.updateMany({
                    where: {
                        userId,
                        type: { in: ['shared_memory', 'memory_share_request', 'share_reaction'] },
                        readAt: null,
                        data: {
                            path: ['bundleId'],
                            equals: id,
                        },
                    },
                    data: { readAt: new Date() },
                }),
            ]);
        }

        return res.json({
            bundle: {
                id: bundle.id,
                sender: bundle.sender,
                message: bundle.message,
                items: bundle.items,
                recipients: isSender ? bundle.recipients : undefined,
                viewerReaction: !isSender ? recipientRecord?.reaction ?? null : null,
                createdAt: bundle.createdAt,
            },
        });
    } catch (error) {
        console.error('Get bundle detail error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * React to a shared bundle.
 * PATCH /api/v1/memory-share/bundles/:id/react
 * Body: { reaction: "grateful" | "inspired" | "understood" | null }
 */
export const reactToBundle = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        const { id } = req.params;
        const { reaction } = req.body;

        const validReactions = ['grateful', 'inspired', 'understood', null];
        if (!validReactions.includes(reaction)) {
            return res.status(400).json({ message: 'Invalid reaction' });
        }

        const recipient = await prisma.sharedMemoryRecipient.findFirst({
            where: { bundleId: id, recipientId: userId },
            include: { bundle: { select: { senderId: true, status: true } } },
        });

        if (!recipient) {
            return res.status(404).json({ message: 'Bundle not found' });
        }

        if (recipient.bundle.status === 'REVOKED') {
            return res.status(410).json({ message: 'This shared memory has been revoked' });
        }

        if (recipient.status !== MemoryShareAccessStatus.ACCEPTED) {
            return res.status(403).json({ message: 'Accept this share request before reacting' });
        }

        if (recipient.reaction === reaction) {
            return res.json({ message: 'Reaction unchanged', reaction });
        }

        await prisma.sharedMemoryRecipient.update({
            where: { id: recipient.id },
            data: { reaction },
        });

        if (reaction) {
            const reactor = await prisma.user.findUnique({
                where: { id: userId },
                select: { name: true },
            });

            const reactorName = reactor?.name || 'Someone';
            const display = REACTION_DISPLAY[reaction] ?? { emoji: '', label: reaction };
            const friendlyBody = `${reactorName} felt ${display.label} ${display.emoji}`;

            // Deduplicate: update existing reaction notification for this bundle+reactor
            // instead of creating a new one each time they change their reaction.
            const existingReactionNotif = await prisma.inAppNotification.findFirst({
                where: {
                    userId: recipient.bundle.senderId,
                    type: 'share_reaction',
                    data: {
                        path: ['bundleId'],
                        equals: id,
                    },
                },
                orderBy: { createdAt: 'desc' },
            });

            let notificationId: string;
            if (existingReactionNotif) {
                await prisma.inAppNotification.update({
                    where: { id: existingReactionNotif.id },
                    data: {
                        title: 'Reaction to your shared memories',
                        body: friendlyBody,
                        readAt: null, // Re-surface as unread
                        data: { bundleId: id, reactorId: userId, reaction, route: `/shared/view?id=${id}` },
                    },
                });
                notificationId = existingReactionNotif.id;
            } else {
                const newNotif = await prisma.inAppNotification.create({
                    data: {
                        userId: recipient.bundle.senderId,
                        type: 'share_reaction',
                        title: 'Reaction to your shared memories',
                        body: friendlyBody,
                        data: { bundleId: id, reactorId: userId, reaction, route: `/shared/view?id=${id}` },
                    },
                });
                notificationId = newNotif.id;
            }

            pushService.sendPushNotification(recipient.bundle.senderId, {
                title: 'Reaction to your shared memories',
                body: friendlyBody,
                data: {
                    type: 'share_reaction',
                    route: `/shared/view?id=${id}`,
                    bundleId: id,
                    notificationId,
                },
            }).catch((err) => console.error('Push notification failed:', err));
        }

        return res.json({ message: 'Reaction updated', reaction });
    } catch (error) {
        console.error('React to bundle error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * Mark shared-memory notifications as read once the user opens the Shared
 * surface in the app. Keep bundle rows unread until the recipient opens a
 * bundle or responds to a request so unread-only lists still have something
 * to render.
 * PATCH /api/v1/memory-share/notifications/read
 */
export const markSharedNotificationsRead = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        const readAt = new Date();

        await prisma.inAppNotification.updateMany({
            where: {
                userId,
                type: { in: [...SHARED_NOTIFICATION_TYPES] },
                readAt: null,
            },
            data: { readAt },
        });

        return res.json({ message: 'Shared notifications marked as read' });
    } catch (error) {
        console.error('Mark shared notifications read error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * Revoke a shared bundle (sender only).
 * DELETE /api/v1/memory-share/bundles/:id
 */
export const revokeBundle = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        const { id } = req.params;

        const bundle = await prisma.sharedMemoryBundle.findFirst({
            where: { id, senderId: userId },
        });

        if (!bundle) {
            return res.status(404).json({ message: 'Bundle not found' });
        }

        await prisma.$transaction([
            prisma.sharedMemoryBundle.update({
                where: { id },
                data: { status: 'REVOKED' },
            }),
            // Clean up stale notifications that would deep-link to this revoked bundle
            prisma.inAppNotification.deleteMany({
                where: {
                    type: { in: ['shared_memory', 'memory_share_request', 'share_reaction'] },
                    readAt: null,
                    data: {
                        path: ['bundleId'],
                        equals: id,
                    },
                },
            }),
        ]);

        return res.json({ message: 'Shared memory revoked' });
    } catch (error) {
        console.error('Revoke bundle error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * Get share stats for entries the current user has shared.
 * Returns share count and reactions per entry ID.
 * GET /api/v1/memory-share/entry-share-stats
 */
export const entryShareStats = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;

        const items = await prisma.sharedMemoryItem.findMany({
            where: {
                bundle: {
                    senderId: userId,
                    status: 'ACTIVE',
                },
            },
            select: {
                entryId: true,
                bundleId: true,
                bundle: {
                    select: {
                        recipients: {
                            where: { status: MemoryShareAccessStatus.ACCEPTED },
                            select: {
                                reaction: true,
                                recipient: { select: { name: true } },
                            },
                        },
                    },
                },
            },
        });

        // Aggregate per entry
        const stats: Record<string, {
            shareCount: number;
            reactions: Array<{ name: string; reaction: string }>;
        }> = {};

        const seenBundles: Record<string, Set<string>> = {};

        for (const item of items) {
            if (!stats[item.entryId]) {
                stats[item.entryId] = { shareCount: 0, reactions: [] };
                seenBundles[item.entryId] = new Set();
            }

            // Count unique bundles per entry (one share action = one bundle)
            if (!seenBundles[item.entryId].has(item.bundleId)) {
                seenBundles[item.entryId].add(item.bundleId);
                stats[item.entryId].shareCount++;
            }

            for (const r of item.bundle.recipients) {
                if (r.reaction) {
                    stats[item.entryId].reactions.push({
                        name: r.recipient.name || 'Someone',
                        reaction: r.reaction,
                    });
                }
            }
        }

        return res.json({ stats });
    } catch (error) {
        console.error('Entry share stats error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};
