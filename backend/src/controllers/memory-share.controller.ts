import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { PushNotificationService } from '../services/push-notification.service';

const pushService = new PushNotificationService(prisma);

/** Mask an email for privacy: "john@gmail.com" → "j***@gmail.com" */
const maskEmail = (email: string) => {
    const [local, domain] = email.split('@');
    if (!local || !domain) return '***';
    return `${local[0]}***@${domain}`;
};

/**
 * Search Notive users by name or email prefix (for recipient picker).
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

        // Exclude users who blocked me or whom I blocked
        const blocks = await prisma.userBlock.findMany({
            where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
            select: { blockerId: true, blockedId: true },
        });
        const blockedIds = blocks.map((b) =>
            b.blockerId === userId ? b.blockedId : b.blockerId,
        );

        const users = await prisma.user.findMany({
            where: {
                id: { not: userId, notIn: blockedIds },
                isBanned: false,
                profile: { onboardingCompletedAt: { not: null } },
                OR: [
                    { name: { contains: q, mode: 'insensitive' } },
                    { email: { startsWith: q, mode: 'insensitive' } },
                ],
            },
            select: { id: true, name: true, avatarUrl: true, email: true },
            take: limit,
            orderBy: { name: 'asc' },
        });

        return res.json({
            users: users.map((u) => ({
                id: u.id,
                name: u.name,
                avatarUrl: u.avatarUrl,
                email: maskEmail(u.email),
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

        // Get distinct recipients from bundles this user sent, ordered by most recent
        const recipients = await prisma.sharedMemoryRecipient.findMany({
            where: { bundle: { senderId: userId, status: 'ACTIVE' } },
            select: {
                recipientId: true,
                createdAt: true,
                recipient: { select: { id: true, name: true, avatarUrl: true, email: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

        // Deduplicate by recipientId, keeping most recent
        const seen = new Set<string>();
        const unique = recipients.filter((r) => {
            if (seen.has(r.recipientId)) return false;
            seen.add(r.recipientId);
            return true;
        }).slice(0, limit);

        return res.json({
            users: unique.map((r) => ({
                id: r.recipient.id,
                name: r.recipient.name,
                avatarUrl: r.recipient.avatarUrl,
                email: maskEmail(r.recipient.email),
            })),
        });
    } catch (error) {
        console.error('Recent recipients error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * Create a shared memory bundle (the share action).
 * POST /api/v1/memory-share/bundles
 * Body: { entryIds: string[], recipientIds: string[], message?: string }
 */
export const createBundle = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        const { entryIds, recipientIds, message } = req.body;

        // Validate input
        if (!Array.isArray(entryIds) || entryIds.length === 0 || entryIds.length > 10) {
            return res.status(400).json({ message: 'Provide 1-10 entry IDs' });
        }
        if (!Array.isArray(recipientIds) || recipientIds.length === 0 || recipientIds.length > 5) {
            return res.status(400).json({ message: 'Provide 1-5 recipient IDs' });
        }
        if (message && typeof message === 'string' && message.length > 500) {
            return res.status(400).json({ message: 'Message must be 500 characters or fewer' });
        }
        if (recipientIds.includes(userId)) {
            return res.status(400).json({ message: 'Cannot share with yourself' });
        }

        // Verify all entries belong to sender and are not deleted
        const entries = await prisma.entry.findMany({
            where: { id: { in: entryIds }, userId, deletedAt: null },
            select: {
                id: true, title: true, content: true, mood: true,
                tags: true, coverImage: true, createdAt: true,
            },
        });

        if (entries.length !== entryIds.length) {
            return res.status(400).json({ message: 'One or more entries not found' });
        }

        // Verify all recipients exist and are not banned
        const recipients = await prisma.user.findMany({
            where: { id: { in: recipientIds }, isBanned: false },
            select: { id: true, name: true },
        });

        if (recipients.length !== recipientIds.length) {
            return res.status(400).json({ message: 'One or more recipients not found' });
        }

        // Verify all recipients are accepted friends
        const friendships = await prisma.friendship.findMany({
            where: {
                status: 'ACCEPTED',
                OR: [
                    { requesterId: userId, addresseeId: { in: recipientIds } },
                    { addresseeId: userId, requesterId: { in: recipientIds } },
                ],
            },
            select: { requesterId: true, addresseeId: true },
        });
        const friendIds = new Set(
            friendships.map((f) => (f.requesterId === userId ? f.addresseeId : f.requesterId)),
        );
        const nonFriends = recipientIds.filter((id: string) => !friendIds.has(id));
        if (nonFriends.length > 0) {
            return res.status(403).json({ message: 'You can only share memories with accepted friends' });
        }

        // Get sender name for notifications
        const sender = await prisma.user.findUnique({
            where: { id: userId },
            select: { name: true },
        });

        // Create bundle, items, recipients, and notifications in a transaction
        const bundle = await prisma.$transaction(async (tx) => {
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
                        create: recipientIds.map((recipientId: string) => ({ recipientId })),
                    },
                },
            });

            // Create in-app notifications for each recipient
            const senderName = sender?.name || 'Someone';
            const entryCount = entries.length;
            await tx.inAppNotification.createMany({
                data: recipientIds.map((recipientId: string) => ({
                    userId: recipientId,
                    type: 'shared_memory',
                    title: `${senderName} shared ${entryCount} ${entryCount === 1 ? 'memory' : 'memories'} with you`,
                    data: {
                        bundleId: newBundle.id,
                        senderId: userId,
                        senderName,
                        entryCount,
                    },
                })),
            });

            return newBundle;
        });

        // Send push notifications (fire and forget — don't block the response)
        const senderName = sender?.name || 'Someone';
        for (const recipientId of recipientIds) {
            pushService.sendPushNotification(recipientId, {
                title: 'New shared memories',
                body: `${senderName} shared ${entries.length} ${entries.length === 1 ? 'memory' : 'memories'} with you`,
                data: { route: '/timeline?tab=shared', bundleId: bundle.id },
            }).catch((err) => console.error('Push notification failed:', err));
        }

        return res.status(201).json({
            bundle: {
                id: bundle.id,
                itemCount: entries.length,
                recipientCount: recipientIds.length,
                createdAt: bundle.createdAt,
            },
        });
    } catch (error) {
        console.error('Create bundle error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * List bundles shared with me (inbox).
 * GET /api/v1/memory-share/received?page=1&limit=20
 */
export const listReceived = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));

        const where = {
            recipientId: userId,
            bundle: { status: 'ACTIVE' as const },
        };

        const [records, total] = await Promise.all([
            prisma.sharedMemoryRecipient.findMany({
                where,
                orderBy: { createdAt: 'desc' },
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
        ]);

        const bundles = records.map((r) => ({
            bundleId: r.bundle.id,
            sender: r.bundle.sender,
            message: r.bundle.message,
            itemCount: r.bundle._count.items,
            firstItem: r.bundle.items[0] ? {
                title: r.bundle.items[0].snapshotTitle,
                contentPreview: r.bundle.items[0].snapshotContent.slice(0, 120),
                mood: r.bundle.items[0].snapshotMood,
            } : null,
            readAt: r.readAt,
            reaction: r.reaction,
            sharedAt: r.createdAt,
        }));

        const unreadCount = await prisma.sharedMemoryRecipient.count({
            where: { recipientId: userId, readAt: null, bundle: { status: 'ACTIVE' } },
        });

        return res.json({ bundles, total, unreadCount, page, limit });
    } catch (error) {
        console.error('List received error:', error);
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

        // Verify access: user is sender or a recipient
        const isSender = bundle.sender.id === userId;
        const recipientRecord = bundle.recipients.find((r) => r.recipientId === userId);

        if (!isSender && !recipientRecord) {
            return res.status(403).json({ message: 'Access denied' });
        }

        // Auto-mark as read if recipient viewing for the first time
        if (recipientRecord && !recipientRecord.readAt) {
            await prisma.sharedMemoryRecipient.updateMany({
                where: { bundleId: id, recipientId: userId },
                data: { readAt: new Date() },
            });
        }

        return res.json({
            bundle: {
                id: bundle.id,
                sender: bundle.sender,
                message: bundle.message,
                items: bundle.items,
                recipients: isSender ? bundle.recipients : undefined,
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

        await prisma.sharedMemoryRecipient.update({
            where: { id: recipient.id },
            data: { reaction },
        });

        // Notify sender of the reaction (if adding, not removing)
        if (reaction) {
            const reactor = await prisma.user.findUnique({
                where: { id: userId },
                select: { name: true },
            });

            await prisma.inAppNotification.create({
                data: {
                    userId: recipient.bundle.senderId,
                    type: 'share_reaction',
                    title: `${reactor?.name || 'Someone'} reacted "${reaction}" to your shared memories`,
                    data: { bundleId: id, reactorId: userId, reaction },
                },
            });

            pushService.sendPushNotification(recipient.bundle.senderId, {
                title: 'Reaction to your shared memories',
                body: `${reactor?.name || 'Someone'} felt "${reaction}"`,
                data: { route: '/timeline?tab=shared', bundleId: id },
            }).catch((err) => console.error('Push notification failed:', err));
        }

        return res.json({ message: 'Reaction updated', reaction });
    } catch (error) {
        console.error('React to bundle error:', error);
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

        await prisma.sharedMemoryBundle.update({
            where: { id },
            data: { status: 'REVOKED' },
        });

        return res.json({ message: 'Shared memory revoked' });
    } catch (error) {
        console.error('Revoke bundle error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};
