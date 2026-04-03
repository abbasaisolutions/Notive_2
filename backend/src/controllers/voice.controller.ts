import { Request, Response } from 'express';
import voiceLexiconService from '../services/voice-lexicon.service';
import voiceTranscriptionJobService from '../services/voice-transcription-job.service';
import voiceTranscriptionService, { type VoiceLanguageMode } from '../services/voice-transcription.service';

const ALLOWED_MIME_TYPES = new Set(['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/ogg']);
const MAX_SYNC_AUDIO_BYTES = 15 * 1024 * 1024;
const MAX_ASYNC_AUDIO_BYTES = 50 * 1024 * 1024;
const MAX_SYNC_DURATION_MS = 10 * 60 * 1000;
const MAX_ASYNC_DURATION_MS = 30 * 60 * 1000;
const ALLOWED_LANGUAGE_MODES = new Set<VoiceLanguageMode>([
    'auto',
    'en',
    'es',
    'fr',
    'ar',
    'ur',
    'pa',
    'hi',
    'bn',
    'fa',
    'tr',
    'de',
    'pt',
    'it',
    'zh',
    'ja',
    'ko',
    'en-ur',
    'en-pa',
    'en-ar',
    'other',
]);

const normalizeLanguageMode = (value: unknown): VoiceLanguageMode => {
    if (typeof value !== 'string') return 'auto';
    const normalized = value.trim().toLowerCase() as VoiceLanguageMode;
    return ALLOWED_LANGUAGE_MODES.has(normalized) ? normalized : 'auto';
};

const normalizeOptionalText = (value: unknown, maxLength = 240): string | null => {
    if (typeof value !== 'string') return null;
    const normalized = value.replace(/\s+/g, ' ').trim();
    return normalized ? normalized.slice(0, maxLength) : null;
};

const normalizeAudioMimeType = (value: unknown): string => {
    if (typeof value !== 'string') return '';

    const baseType = value
        .split(';', 1)[0]
        ?.trim()
        .toLowerCase();

    switch (baseType) {
        case 'audio/mp3':
            return 'audio/mpeg';
        case 'audio/x-m4a':
            return 'audio/mp4';
        case 'audio/x-wav':
        case 'audio/wave':
            return 'audio/wav';
        default:
            return baseType || '';
    }
};

const parseDurationMs = (value: unknown): number | null => {
    if (typeof value !== 'string' && typeof value !== 'number') return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric) : null;
};

const normalizeCandidateLanguages = (value: unknown): string[] => {
    const rawValues = Array.isArray(value)
        ? value
        : typeof value === 'string'
            ? value.split(',')
            : [];

    return Array.from(
        new Set(
            rawValues
                .filter((item): item is string => typeof item === 'string')
                .map((item) => item.replace(/\s+/g, ' ').trim().toLowerCase())
                .filter(Boolean)
                .slice(0, 6)
        )
    );
};

const normalizeCaptureMeta = (value: unknown): Record<string, unknown> | null => {
    if (!value) return null;

    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
                ? parsed as Record<string, unknown>
                : null;
        } catch {
            return null;
        }
    }

    if (typeof value === 'object' && !Array.isArray(value)) {
        return value as Record<string, unknown>;
    }

    return null;
};

export const transcribeVoice = async (req: Request, res: Response) => {
    try {
        const uploaded = req.file;
        if (!uploaded) {
            return res.status(400).json({
                code: 'VOICE_FILE_MISSING',
                message: 'Audio file is required.',
                retryable: false,
            });
        }

        const mimeType = normalizeAudioMimeType(uploaded.mimetype);

        if (!ALLOWED_MIME_TYPES.has(mimeType)) {
            return res.status(400).json({
                code: 'VOICE_UNSUPPORTED_FORMAT',
                message: 'Unsupported audio format.',
                retryable: false,
            });
        }

        if (uploaded.size > MAX_SYNC_AUDIO_BYTES) {
            return res.status(413).json({
                code: 'VOICE_FILE_TOO_LARGE',
                message: 'Audio file exceeds the current size limit.',
                retryable: false,
            });
        }

        const durationMs = parseDurationMs(req.body?.recordingDurationMs);
        if (durationMs && durationMs > MAX_SYNC_DURATION_MS) {
            return res.status(400).json({
                code: 'VOICE_DURATION_LIMIT_EXCEEDED',
                message: 'Audio recording is too long for the current voice flow.',
                retryable: false,
            });
        }

        const result = await voiceTranscriptionService.transcribe({
            audioBuffer: uploaded.buffer,
            filename: uploaded.originalname || 'voice-note.webm',
            mimeType,
            languageMode: normalizeLanguageMode(req.body?.languageMode),
            hintText: normalizeOptionalText(req.body?.hintText),
            entryContext: normalizeOptionalText(req.body?.entryContext, 140),
            candidateLanguages: normalizeCandidateLanguages(req.body?.candidateLanguages),
            captureMeta: normalizeCaptureMeta(req.body?.captureMeta),
            requestId: res.locals.requestId || null,
            userId: req.userId || null,
        });

        return res.status(200).json(result);
    } catch (error: any) {
        const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
        return res.status(statusCode).json({
            code: error?.code || 'VOICE_TRANSCRIPTION_FAILED',
            message: error?.message || 'Voice transcription failed.',
            retryable: Boolean(error?.retryable),
        });
    }
};

export const createVoiceTranscriptionJob = async (req: Request, res: Response) => {
    try {
        const uploaded = req.file as Express.MulterFileWithLocation | undefined;
        if (!uploaded) {
            return res.status(400).json({
                code: 'VOICE_FILE_MISSING',
                message: 'Audio file is required.',
                retryable: false,
            });
        }

        const mimeType = normalizeAudioMimeType(uploaded.mimetype);

        if (!ALLOWED_MIME_TYPES.has(mimeType)) {
            return res.status(400).json({
                code: 'VOICE_UNSUPPORTED_FORMAT',
                message: 'Unsupported audio format.',
                retryable: false,
            });
        }

        if (uploaded.size > MAX_ASYNC_AUDIO_BYTES) {
            return res.status(413).json({
                code: 'VOICE_FILE_TOO_LARGE',
                message: 'Audio file exceeds the current async size limit.',
                retryable: false,
            });
        }

        const durationMs = parseDurationMs(req.body?.recordingDurationMs);
        if (durationMs && durationMs > MAX_ASYNC_DURATION_MS) {
            return res.status(400).json({
                code: 'VOICE_DURATION_LIMIT_EXCEEDED',
                message: 'Audio recording is too long for the current voice flow.',
                retryable: false,
            });
        }

        const job = await voiceTranscriptionJobService.createJob({
            userId: req.userId,
            entryId: normalizeOptionalText(req.body?.entryId, 64),
            audioBuffer: uploaded.buffer,
            fileName: uploaded.originalname || uploaded.filename || 'voice-note.webm',
            mimeType,
            languageMode: normalizeLanguageMode(req.body?.languageMode),
            candidateLanguages: normalizeCandidateLanguages(req.body?.candidateLanguages),
            recordingDurationMs: durationMs,
            hintText: normalizeOptionalText(req.body?.hintText),
            previewText: normalizeOptionalText(req.body?.previewText, 12000),
            entryContext: normalizeOptionalText(req.body?.entryContext, 140),
            captureMeta: normalizeCaptureMeta(req.body?.captureMeta),
        });

        const hydrated = await voiceTranscriptionJobService.getJobForUser(job.id, req.userId);
        return res.status(202).json({
            job: voiceTranscriptionJobService.toClientPayload(hydrated),
        });
    } catch (error: any) {
        return res.status(500).json({
            code: 'VOICE_JOB_CREATE_FAILED',
            message: error?.message || 'Failed to create voice transcription job.',
            retryable: true,
        });
    }
};

export const attachVoiceTranscriptionJob = async (req: Request, res: Response) => {
    try {
        const entryId = normalizeOptionalText(req.body?.entryId, 64);
        if (!entryId) {
            return res.status(400).json({
                code: 'VOICE_ENTRY_ID_REQUIRED',
                message: 'Entry id is required to attach a voice transcription job.',
            });
        }

        const job = await voiceTranscriptionJobService.attachJobToEntry(req.params.id, req.userId, entryId);
        if (!job) {
            return res.status(404).json({
                code: 'VOICE_JOB_NOT_FOUND',
                message: 'Voice transcription job not found.',
            });
        }

        return res.status(200).json({
            job: voiceTranscriptionJobService.toClientPayload(job),
        });
    } catch (error: any) {
        return res.status(500).json({
            code: 'VOICE_ATTACH_ERROR',
            message: error?.message || 'Failed to attach voice transcription job.',
        });
    }
};

export const getVoiceTranscriptionJob = async (req: Request, res: Response) => {
    try {
        const job = await voiceTranscriptionJobService.getJobForUser(req.params.id, req.userId);
        if (!job) {
            return res.status(404).json({
                code: 'VOICE_JOB_NOT_FOUND',
                message: 'Voice transcription job not found.',
            });
        }

        return res.status(200).json({
            job: voiceTranscriptionJobService.toClientPayload(job),
        });
    } catch (error: any) {
        return res.status(500).json({
            code: 'VOICE_JOB_FETCH_ERROR',
            message: error?.message || 'Failed to fetch voice transcription job.',
        });
    }
};

export const cancelVoiceTranscriptionJob = async (req: Request, res: Response) => {
    try {
        const canceled = await voiceTranscriptionJobService.cancelJob(req.params.id, req.userId);
        if (!canceled) {
            return res.status(404).json({
                code: 'VOICE_JOB_NOT_FOUND',
                message: 'Voice transcription job not found or cannot be canceled.',
            });
        }

        const job = await voiceTranscriptionJobService.getJobForUser(req.params.id, req.userId);
        return res.status(200).json({
            job: voiceTranscriptionJobService.toClientPayload(job),
        });
    } catch (error: any) {
        return res.status(500).json({
            code: 'VOICE_CANCEL_ERROR',
            message: error?.message || 'Failed to cancel voice transcription job.',
        });
    }
};

export const listVoiceLexiconItems = async (req: Request, res: Response) => {
    try {
        const items = await voiceLexiconService.listForUser(req.userId);
        return res.status(200).json({ items });
    } catch (error: any) {
        return res.status(500).json({
            code: 'VOICE_LEXICON_ERROR',
            message: error?.message || 'Failed to list voice lexicon items.',
        });
    }
};

export const upsertVoiceLexiconItem = async (req: Request, res: Response) => {
    try {
        const item = await voiceLexiconService.upsert({
            userId: req.userId,
            canonical: req.body?.canonical,
            aliases: Array.isArray(req.body?.aliases) ? req.body.aliases : undefined,
            locale: req.body?.locale,
            itemType: req.body?.itemType,
            boost: typeof req.body?.boost === 'number' ? req.body.boost : Number(req.body?.boost),
        });

        return res.status(201).json({ item });
    } catch (error: any) {
        return res.status(400).json({
            code: 'VOICE_LEXICON_INVALID',
            message: error?.message || 'Failed to save voice lexicon item.',
        });
    }
};

export const deleteVoiceLexiconItem = async (req: Request, res: Response) => {
    const result = await voiceLexiconService.delete(req.userId, req.params.id);
    if (result.count === 0) {
        return res.status(404).json({
            code: 'VOICE_LEXICON_NOT_FOUND',
            message: 'Voice lexicon item not found.',
        });
    }

    return res.status(204).send();
};
