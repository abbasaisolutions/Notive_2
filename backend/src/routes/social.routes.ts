import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { getSocialFeed, importPosts } from '../controllers/social.controller';

const router = Router();

router.use(authMiddleware);

router.get('/:source', getSocialFeed);
router.post('/import', importPosts);

export default router;
