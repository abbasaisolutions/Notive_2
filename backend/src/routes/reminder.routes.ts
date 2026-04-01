import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { getReminder, upsertReminder, deleteReminder } from '../controllers/reminder.controller';
import { validate, upsertReminderSchema } from '../utils/validation';

const router = Router();

router.use(authMiddleware);

router.get('/', getReminder);
router.put('/', validate(upsertReminderSchema), upsertReminder);
router.delete('/', deleteReminder);

export default router;
