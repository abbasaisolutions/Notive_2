import multer from 'multer';
import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { createRateLimiter } from '../middleware/rate-limit.middleware';
import { securityConfig } from '../config/security';
import {
    attachVoiceTranscriptionJob,
    cancelVoiceTranscriptionJob,
    createVoiceTranscriptionJob,
    deleteVoiceLexiconItem,
    getVoiceTranscriptionJob,
    listVoiceLexiconItems,
    transcribeVoice,
    upsertVoiceLexiconItem,
} from '../controllers/voice.controller';
import { createUpload } from '../services/file.service';

const router = Router();

const voiceLimiter = createRateLimiter({
    keyPrefix: 'voice',
    windowMs: securityConfig.rateLimits.voiceTranscription.windowMs,
    max: securityConfig.rateLimits.voiceTranscription.max,
    message: 'Voice transcription requests are coming in too quickly. Please wait a moment and try again.',
    keyGenerator: (req) => req.userId || req.ip || 'anonymous',
});

const legacyVoiceUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 15 * 1024 * 1024,
    },
});

const voiceJobUpload = createUpload(50 * 1024 * 1024);

router.use(authMiddleware);

router.post('/transcribe', voiceLimiter, legacyVoiceUpload.single('audio'), transcribeVoice);
router.post('/jobs', voiceLimiter, voiceJobUpload.single('audio'), createVoiceTranscriptionJob);
router.post('/jobs/:id/attach', attachVoiceTranscriptionJob);
router.get('/jobs/:id', getVoiceTranscriptionJob);
router.post('/jobs/:id/cancel', cancelVoiceTranscriptionJob);
router.get('/lexicon', listVoiceLexiconItems);
router.post('/lexicon', upsertVoiceLexiconItem);
router.delete('/lexicon/:id', deleteVoiceLexiconItem);

export default router;
