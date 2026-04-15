import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import {
    sendFriendRequest,
    acceptFriendRequest,
    declineFriendRequest,
    removeFriend,
    listFriendships,
    blockUser,
    unblockUser,
    listBlockedUsers,
} from '../controllers/friendship.controller';
import { friendshipUserSchema, validate } from '../utils/validation';

const router = Router();

router.use(authMiddleware);

// Friendships
router.get('/', listFriendships);
router.post('/request', validate(friendshipUserSchema), sendFriendRequest);
router.patch('/:id/accept', acceptFriendRequest);
router.patch('/:id/decline', declineFriendRequest);
router.delete('/:id', removeFriend);

// Blocks
router.get('/blocked', listBlockedUsers);
router.post('/block', validate(friendshipUserSchema), blockUser);
router.delete('/block/:userId', unblockUser);

export default router;
