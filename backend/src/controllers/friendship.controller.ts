import { MemoryShareAccessStatus } from '@prisma/client';
import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { PushNotificationService } from '../services/push-notification.service';

const pushService = new PushNotificationService(prisma);

// ── Helpers ─────────────────────────────────────────────────

/** Check whether a block exists in either direction between two users. */
const isBlocked = async (userA: string, userB: string): Promise<boolean> => {
    const count = await prisma.userBlock.count({
        where: {
            OR: [
                { blockerId: userA, blockedId: userB },
                { blockerId: userB, blockedId: userA },
            ],
        },
    });
    return count > 0;
};

// ── Send a friend request ───────────────────────────────────

/**
 * POST /api/v1/friendships/request
 * Body: { userId: string }
 */
export const sendFriendRequest = async (req: Request, res: Response) => {
    try {
        const requesterId = req.userId;
        const { userId: addresseeId } = req.body;

        if (!addresseeId || typeof addresseeId !== 'string') {
            return res.status(400).json({ message: 'userId is required' });
        }
        if (addresseeId === requesterId) {
            return res.status(400).json({ message: 'Cannot send a friend request to yourself' });
        }

        // Verify addressee exists
        const addressee = await prisma.user.findUnique({
            where: { id: addresseeId, isBanned: false },
            select: { id: true, name: true },
        });
        if (!addressee) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check blocks
        if (await isBlocked(requesterId, addresseeId)) {
            return res.status(403).json({ message: 'Cannot send request to this user' });
        }

        // Check for existing friendship/request in either direction
        const existing = await prisma.friendship.findFirst({
            where: {
                OR: [
                    { requesterId, addresseeId },
                    { requesterId: addresseeId, addresseeId: requesterId },
                ],
            },
        });

        if (existing) {
            if (existing.status === 'ACCEPTED') {
                return res.status(409).json({ message: 'Already friends' });
            }
            if (existing.status === 'PENDING') {
                // If the other user already sent us a request, auto-accept
                if (existing.requesterId === addresseeId) {
                    await prisma.friendship.update({
                        where: { id: existing.id },
                        data: { status: 'ACCEPTED' },
                    });
                    return res.json({ message: 'Friend request accepted (they already requested you)', status: 'ACCEPTED' });
                }
                return res.status(409).json({ message: 'Friend request already pending' });
            }
            // DECLINED → allow re-requesting by updating
            await prisma.friendship.update({
                where: { id: existing.id },
                data: { requesterId, addresseeId, status: 'PENDING', updatedAt: new Date() },
            });
        } else {
            await prisma.friendship.create({
                data: { requesterId, addresseeId },
            });
        }

        // Notify the addressee
        const requester = await prisma.user.findUnique({
            where: { id: requesterId },
            select: { name: true },
        });
        const senderName = requester?.name || 'Someone';

        await prisma.inAppNotification.create({
            data: {
                userId: addresseeId,
                type: 'friend_request',
                title: `${senderName} sent you a friend request`,
                data: { requesterId, senderName, route: '/timeline?view=shared' },
            },
        });

        pushService.sendPushNotification(addresseeId, {
            title: 'New friend request',
            body: `${senderName} wants to connect with you`,
            data: { type: 'friend_request', route: '/timeline?view=shared' },
        }).catch(() => {});

        return res.status(201).json({ message: 'Friend request sent', status: 'PENDING' });
    } catch (error) {
        console.error('Send friend request error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

// ── Accept a friend request ─────────────────────────────────

/**
 * PATCH /api/v1/friendships/:id/accept
 */
export const acceptFriendRequest = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        const { id } = req.params;

        const friendship = await prisma.friendship.findFirst({
            where: { id, addresseeId: userId, status: 'PENDING' },
            include: { requester: { select: { id: true, name: true } } },
        });

        if (!friendship) {
            return res.status(404).json({ message: 'Pending friend request not found' });
        }

        // Notify requester and clear the incoming request notification for the addressee.
        const acceptor = await prisma.user.findUnique({
            where: { id: userId },
            select: { name: true },
        });

        await prisma.$transaction([
            prisma.friendship.update({
                where: { id },
                data: { status: 'ACCEPTED' },
            }),
            prisma.inAppNotification.updateMany({
                where: {
                    userId,
                    type: 'friend_request',
                    readAt: null,
                    data: {
                        path: ['requesterId'],
                        equals: friendship.requesterId,
                    },
                },
                data: { readAt: new Date() },
            }),
            prisma.inAppNotification.create({
                data: {
                    userId: friendship.requesterId,
                    type: 'friend_accepted',
                    title: `${acceptor?.name || 'Someone'} accepted your friend request`,
                    data: { userId, acceptorName: acceptor?.name, route: '/timeline?view=shared' },
                },
            }),
        ]);

        pushService.sendPushNotification(friendship.requesterId, {
            title: 'Friend request accepted!',
            body: `${acceptor?.name || 'Someone'} is now your friend`,
            data: { type: 'friend_accepted', route: '/timeline?view=shared' },
        }).catch(() => {});

        return res.json({ message: 'Friend request accepted', status: 'ACCEPTED' });
    } catch (error) {
        console.error('Accept friend request error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

// ── Decline a friend request ────────────────────────────────

/**
 * PATCH /api/v1/friendships/:id/decline
 */
export const declineFriendRequest = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        const { id } = req.params;

        const friendship = await prisma.friendship.findFirst({
            where: { id, addresseeId: userId, status: 'PENDING' },
        });

        if (!friendship) {
            return res.status(404).json({ message: 'Pending friend request not found' });
        }

        await prisma.$transaction([
            prisma.friendship.update({
                where: { id },
                data: { status: 'DECLINED' },
            }),
            prisma.inAppNotification.updateMany({
                where: {
                    userId,
                    type: 'friend_request',
                    readAt: null,
                    data: {
                        path: ['requesterId'],
                        equals: friendship.requesterId,
                    },
                },
                data: { readAt: new Date() },
            }),
        ]);

        return res.json({ message: 'Friend request declined' });
    } catch (error) {
        console.error('Decline friend request error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

// ── Remove (unfriend) ───────────────────────────────────────

/**
 * DELETE /api/v1/friendships/:id
 */
export const removeFriend = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        const { id } = req.params;

        const friendship = await prisma.friendship.findFirst({
            where: {
                id,
                OR: [{ requesterId: userId }, { addresseeId: userId }],
            },
        });

        if (!friendship) {
            return res.status(404).json({ message: 'Friendship not found' });
        }

        await prisma.friendship.delete({ where: { id } });

        return res.json({ message: 'Friend removed' });
    } catch (error) {
        console.error('Remove friend error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

// ── List friends ────────────────────────────────────────────

/**
 * GET /api/v1/friendships?status=ACCEPTED|PENDING
 */
export const listFriendships = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        const statusFilter = String(req.query.status || 'ACCEPTED').toUpperCase();

        if (statusFilter === 'PENDING') {
            // Only show incoming pending requests (that I need to act on)
            const pending = await prisma.friendship.findMany({
                where: { addresseeId: userId, status: 'PENDING' },
                include: { requester: { select: { id: true, name: true, avatarUrl: true } } },
                orderBy: { createdAt: 'desc' },
            });

            return res.json({
                friendships: pending.map((f) => ({
                    id: f.id,
                    user: f.requester,
                    status: f.status,
                    createdAt: f.createdAt,
                })),
            });
        }

        // ACCEPTED friends — both directions
        const accepted = await prisma.friendship.findMany({
            where: {
                status: 'ACCEPTED',
                OR: [{ requesterId: userId }, { addresseeId: userId }],
            },
            include: {
                requester: { select: { id: true, name: true, avatarUrl: true } },
                addressee: { select: { id: true, name: true, avatarUrl: true } },
            },
            orderBy: { updatedAt: 'desc' },
        });

        return res.json({
            friendships: accepted.map((f) => {
                const friend = f.requesterId === userId ? f.addressee : f.requester;
                return {
                    id: f.id,
                    user: friend,
                    status: f.status,
                    since: f.updatedAt,
                };
            }),
        });
    } catch (error) {
        console.error('List friendships error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

// ── Block a user ────────────────────────────────────────────

/**
 * POST /api/v1/friendships/block
 * Body: { userId: string }
 */
export const blockUser = async (req: Request, res: Response) => {
    try {
        const blockerId = req.userId;
        const { userId: blockedId } = req.body;

        if (!blockedId || typeof blockedId !== 'string') {
            return res.status(400).json({ message: 'userId is required' });
        }
        if (blockedId === blockerId) {
            return res.status(400).json({ message: 'Cannot block yourself' });
        }

        // Check if already blocked
        const existing = await prisma.userBlock.findUnique({
            where: { blockerId_blockedId: { blockerId, blockedId } },
        });
        if (existing) {
            return res.status(409).json({ message: 'User already blocked' });
        }

        // Block + remove any friendship between the two users in a transaction
        await prisma.$transaction(async (tx) => {
            await tx.userBlock.create({
                data: { blockerId, blockedId },
            });

            // Remove friendship in either direction
            await tx.friendship.deleteMany({
                where: {
                    OR: [
                        { requesterId: blockerId, addresseeId: blockedId },
                        { requesterId: blockedId, addresseeId: blockerId },
                    ],
                },
            });

            await tx.memoryShareAccess.deleteMany({
                where: {
                    OR: [
                        { senderId: blockerId, recipientId: blockedId },
                        { senderId: blockedId, recipientId: blockerId },
                    ],
                },
            });

            await tx.sharedMemoryRecipient.updateMany({
                where: {
                    OR: [
                        {
                            recipientId: blockerId,
                            bundle: { senderId: blockedId },
                        },
                        {
                            recipientId: blockedId,
                            bundle: { senderId: blockerId },
                        },
                    ],
                },
                data: {
                    status: MemoryShareAccessStatus.DECLINED,
                    readAt: new Date(),
                    reaction: null,
                },
            });
        });

        return res.status(201).json({ message: 'User blocked' });
    } catch (error) {
        console.error('Block user error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

// ── Unblock a user ──────────────────────────────────────────

/**
 * DELETE /api/v1/friendships/block/:userId
 */
export const unblockUser = async (req: Request, res: Response) => {
    try {
        const blockerId = req.userId;
        const { userId: blockedId } = req.params;

        const block = await prisma.userBlock.findUnique({
            where: { blockerId_blockedId: { blockerId, blockedId } },
        });

        if (!block) {
            return res.status(404).json({ message: 'Block not found' });
        }

        await prisma.userBlock.delete({ where: { id: block.id } });

        return res.json({ message: 'User unblocked' });
    } catch (error) {
        console.error('Unblock user error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

// ── List blocked users ──────────────────────────────────────

/**
 * GET /api/v1/friendships/blocked
 */
export const listBlockedUsers = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;

        const blocks = await prisma.userBlock.findMany({
            where: { blockerId: userId },
            include: { blocked: { select: { id: true, name: true, avatarUrl: true } } },
            orderBy: { createdAt: 'desc' },
        });

        return res.json({
            blocked: blocks.map((b) => ({
                id: b.id,
                user: b.blocked,
                blockedAt: b.createdAt,
            })),
        });
    } catch (error) {
        console.error('List blocked users error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};
