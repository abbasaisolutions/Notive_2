import axios from 'axios';
import { Prisma, VoiceTranscriptionJobStatus } from '@prisma/client';
import prisma from '../config/prisma';
import { serverLogger } from '../utils/server-logger';
import { upsertEntryAnalysisFromNlp } from './entry-analysis.service';
import nlpService, { type AnalysisResult } from './nlp.service';
import voiceLexiconService from './voice-lexicon.service';
import voiceTranscriptionService, {
    type VoiceLanguageMode,
    type VoiceTranscriptionResult,
} from './voice-transcription.service';

type CreateVoiceTranscriptionJobInput = {
    userId: string;
    entryId?: string | null;
    audioUrl: string;
    fileName?: string | null;
    mimeType: string;
    languageMode: VoiceLanguageMode;
    candidateLanguages?: string[];
    recordingDurationMs?: number | null;
    hintText?: string | null;
    previewText?: string | null;
    entryContext?: string | null;
    captureMeta?: Record<string, unknown> | null;
};

type VoiceTranscriptionJobPayload = {
    audioUrl: string;
    fileName: string | null;
    mimeType: string;
    languageMode: VoiceLanguageMode;
    candidateLanguages: string[];
    recordingDurationMs: number | null;
    hintText: string | null;
    previewText: string | null;
    entryContext: string | null;
    captureMeta: Record<string, unknown> | null;
};

type VoiceTranscriptionJobRecord = {
    id: string;
    userId: string;
    entryId: string | null;
    audioUrl: string;
    fileName: string | null;
    mimeType: string;
    languageMode: string;
    candidateLanguages: string[];
    hintText: string | null;
    entryContext: string | null;
    payload: Prisma.JsonValue;
    captureMeta: Prisma.JsonValue;
    attemptCount: number;
    maxAttempts: number;
};

const parsePositiveInt = (value: string | undefined, fallback: number) => {
    const parsed = Number.parseInt(String(value || ''), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const MAX_AUDIO_FETCH_BYTES = parsePositiveInt(process.env.VOICE_JOB_MAX_AUDIO_BYTES, 60 * 1024 * 1024);
const VOICE_JOB_BATCH_SIZE = parsePositiveInt(process.env.VOICE_JOB_BATCH_SIZE, 2);
const VOICE_JOB_POLL_MS = parsePositiveInt(process.env.VOICE_JOB_POLL_MS, 5000);
const VOICE_JOB_MAX_ATTEMPTS = parsePositiveInt(process.env.VOICE_JOB_MAX_ATTEMPTS, 4);
const VOICE_JOB_STALE_MINUTES = parsePositiveInt(process.env.VOICE_JOB_STALE_MINUTES, 12);
const VOICE_AUDIO_FETCH_TIMEOUT_MS = parsePositiveInt(process.env.VOICE_AUDIO_FETCH_TIMEOUT_MS, 120000);
const VOICE_JOB_WORKER_ID = `voice-worker-${process.pid}`;

const normalizeOptionalText = (value: unknown, maxLength: number): string | null => {
    if (typeof value !== 'string') return null;
    const normalized = value.replace(/\s+/g, ' ').trim();
    return normalized ? normalized.slice(0, maxLength) : null;
};

const normalizeCandidateLanguages = (values: unknown): string[] => {
    if (!Array.isArray(values)) return [];
    return Array.from(
        new Set(
            values
                .filter((value): value is string => typeof value === 'string')
                .map((value) => value.replace(/\s+/g, ' ').trim().toLowerCase())
                .filter(Boolean)
                .slice(0, 6)
        )
    );
};

const normalizeDurationMs = (value: unknown): number | null => {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric) : null;
};

const isJsonObject = (value: unknown): value is Prisma.JsonObject =>
    !!value && typeof value === 'object' && !Array.isArray(value);

const clip01 = (value: number) => Math.min(Math.max(value, 0), 1);

const normalizeComparisonText = (value: unknown): string =>
    typeof value === 'string'
        ? value.replace(/\s+/g, ' ').trim().toLowerCase()
        : '';

const toStringArray = (value: unknown): string[] =>
    Array.isArray(value)
        ? value
            .filter((item): item is string => typeof item === 'string')
            .map((item) => item.trim())
            .filter(Boolean)
        : [];

const mergeUniqueStrings = (...groups: Array<string[] | undefined>) =>
    Array.from(new Set(groups.flatMap((group) => group || []).map((value) => value.trim()).filter(Boolean)));

const buildAiInsightsFromNlp = (analysis: AnalysisResult) => ({
    generatedAt: new Date().toISOString(),
    sentiment: analysis.sentiment,
    entities: analysis.entities || [],
    topics: analysis.topics || [],
    suggestedMood: analysis.suggestedMood || null,
    wordCount: analysis.wordCount || null,
    readingTime: analysis.readingTime || null,
    keywords: analysis.keywords || [],
    emotions: analysis.emotions || null,
    highlights: analysis.highlights || [],
    evidence: analysis.evidence || null,
    memory: analysis.memory || null,
    suggestions: analysis.suggestions || null,
    modelInfo: analysis.modelInfo || null,
    provider: analysis.provider || 'deterministic',
});

const mergeNlpInsightsIntoAnalysis = (
    existingAnalysis: Prisma.JsonObject,
    nlpAnalysis: AnalysisResult | null
): Prisma.JsonObject => {
    if (!nlpAnalysis) {
        return existingAnalysis;
    }

    return {
        ...existingAnalysis,
        ai: cloneJson(buildAiInsightsFromNlp(nlpAnalysis)) as unknown as Prisma.JsonObject,
    };
};

const sanitizeCaptureMeta = (value: Record<string, unknown> | null | undefined) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }

    const averageLevel = Number(value.averageLevel);
    const peakLevel = Number(value.peakLevel);
    const speechRatio = Number(value.speechRatio);
    const clippedRatio = Number(value.clippedRatio);
    const framesObserved = Number(value.framesObserved);
    const issues: string[] = [];

    if (Number.isFinite(speechRatio) && speechRatio < 0.12) {
        issues.push('limited_speech_detected');
    }
    if (Number.isFinite(averageLevel) && averageLevel < 0.015) {
        issues.push('input_too_quiet');
    }
    if (Number.isFinite(peakLevel) && peakLevel > 0.98) {
        issues.push('possible_clipping');
    }
    if (Number.isFinite(clippedRatio) && clippedRatio > 0.02) {
        issues.push('clipping_ratio_high');
    }

    const rating = issues.length >= 2
        ? 'poor'
        : issues.length === 1
            ? 'review'
            : 'good';

    return {
        averageLevel: Number.isFinite(averageLevel) ? clip01(averageLevel) : null,
        peakLevel: Number.isFinite(peakLevel) ? clip01(peakLevel) : null,
        speechRatio: Number.isFinite(speechRatio) ? clip01(speechRatio) : null,
        clippedRatio: Number.isFinite(clippedRatio) ? clip01(clippedRatio) : null,
        framesObserved: Number.isFinite(framesObserved) ? Math.max(0, Math.round(framesObserved)) : null,
        rating,
        issues,
    };
};

const cloneJson = <T>(value: T): T => JSON.parse(JSON.stringify(value ?? null)) as T;

const isVoiceLanguageMode = (value: string): value is VoiceLanguageMode => {
    return new Set<VoiceLanguageMode>([
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
    ]).has(value as VoiceLanguageMode);
};

const parseJobPayload = (payload: Prisma.JsonValue): VoiceTranscriptionJobPayload | null => {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return null;
    }

    const record = payload as Record<string, unknown>;
    if (typeof record.audioUrl !== 'string' || typeof record.mimeType !== 'string' || typeof record.languageMode !== 'string') {
        return null;
    }

    const languageMode = isVoiceLanguageMode(record.languageMode) ? record.languageMode : 'auto';

    return {
        audioUrl: record.audioUrl,
        fileName: typeof record.fileName === 'string' ? record.fileName : null,
        mimeType: record.mimeType,
        languageMode,
        candidateLanguages: normalizeCandidateLanguages(record.candidateLanguages),
        recordingDurationMs: normalizeDurationMs(record.recordingDurationMs),
        hintText: normalizeOptionalText(record.hintText, 240),
        previewText: normalizeOptionalText(record.previewText, 12000),
        entryContext: normalizeOptionalText(record.entryContext, 140),
        captureMeta: sanitizeCaptureMeta(
            record.captureMeta && typeof record.captureMeta === 'object' && !Array.isArray(record.captureMeta)
                ? record.captureMeta as Record<string, unknown>
                : null
        ),
    };
};

class VoiceTranscriptionJobService {
    private workerTimer: NodeJS.Timeout | null = null;
    private isDrainingJobs = false;

    startJobWorker() {
        if (this.workerTimer) {
            return;
        }

        const tick = () => {
            void this.drainVoiceTranscriptionJobs();
        };

        this.workerTimer = setInterval(tick, VOICE_JOB_POLL_MS);
        this.workerTimer.unref?.();
        tick();
    }

    async createJob(input: CreateVoiceTranscriptionJobInput) {
        const payload: VoiceTranscriptionJobPayload = {
            audioUrl: input.audioUrl,
            fileName: normalizeOptionalText(input.fileName, 255),
            mimeType: input.mimeType,
            languageMode: input.languageMode,
            candidateLanguages: normalizeCandidateLanguages(input.candidateLanguages),
            recordingDurationMs: normalizeDurationMs(input.recordingDurationMs),
            hintText: normalizeOptionalText(input.hintText, 240),
            previewText: normalizeOptionalText(input.previewText, 12000),
            entryContext: normalizeOptionalText(input.entryContext, 140),
            captureMeta: sanitizeCaptureMeta(input.captureMeta),
        };

        const now = new Date();
        const job = await prisma.voiceTranscriptionJob.create({
            data: {
                entryId: input.entryId || null,
                userId: input.userId,
                audioUrl: payload.audioUrl,
                fileName: payload.fileName,
                mimeType: payload.mimeType,
                languageMode: payload.languageMode,
                candidateLanguages: payload.candidateLanguages,
                recordingDurationMs: payload.recordingDurationMs,
                hintText: payload.hintText,
                entryContext: payload.entryContext,
                payload: cloneJson(payload) as Prisma.InputJsonValue,
                captureMeta: payload.captureMeta ? cloneJson(payload.captureMeta) as Prisma.InputJsonValue : Prisma.JsonNull,
                status: VoiceTranscriptionJobStatus.PENDING,
                maxAttempts: VOICE_JOB_MAX_ATTEMPTS,
                runAfter: now,
            },
        });

        this.startJobWorker();
        void this.drainVoiceTranscriptionJobs();

        return job;
    }

    async getJobForUser(jobId: string, userId: string) {
        return prisma.voiceTranscriptionJob.findFirst({
            where: {
                id: jobId,
                userId,
            },
        });
    }

    async attachJobToEntry(jobId: string, userId: string, entryId: string) {
        const existing = await prisma.voiceTranscriptionJob.findFirst({
            where: {
                id: jobId,
                userId,
            },
        });

        if (!existing) {
            return null;
        }

        const job = existing.entryId === entryId
            ? existing
            : await prisma.voiceTranscriptionJob.update({
                where: { id: jobId },
                data: { entryId },
            });

        if (job.status === VoiceTranscriptionJobStatus.COMPLETED) {
            await this.syncCompletedTranscriptToEntry(job);
        }

        return job;
    }

    async cancelJob(jobId: string, userId: string) {
        const updated = await prisma.voiceTranscriptionJob.updateMany({
            where: {
                id: jobId,
                userId,
                status: {
                    in: [
                        VoiceTranscriptionJobStatus.PENDING,
                        VoiceTranscriptionJobStatus.PROCESSING,
                    ],
                },
            },
            data: {
                status: VoiceTranscriptionJobStatus.CANCELED,
                canceledAt: new Date(),
                lockedAt: null,
                lockedBy: null,
                lastError: null,
            },
        });

        return updated.count > 0;
    }

    private async claimPendingJobs(batchSize: number): Promise<VoiceTranscriptionJobRecord[]> {
        const now = new Date();
        const staleBefore = new Date(Date.now() - (VOICE_JOB_STALE_MINUTES * 60 * 1000));
        const candidates = await prisma.voiceTranscriptionJob.findMany({
            where: {
                OR: [
                    {
                        status: VoiceTranscriptionJobStatus.PENDING,
                        runAfter: { lte: now },
                    },
                    {
                        status: VoiceTranscriptionJobStatus.PROCESSING,
                        lockedAt: { lt: staleBefore },
                    },
                ],
            },
            orderBy: [
                { runAfter: 'asc' },
                { createdAt: 'asc' },
            ],
            take: batchSize,
            select: {
                id: true,
                userId: true,
                entryId: true,
                audioUrl: true,
                fileName: true,
                mimeType: true,
                languageMode: true,
                candidateLanguages: true,
                hintText: true,
                entryContext: true,
                payload: true,
                captureMeta: true,
                attemptCount: true,
                maxAttempts: true,
            },
        });

        const claimed: VoiceTranscriptionJobRecord[] = [];
        for (const candidate of candidates) {
            const updated = await prisma.voiceTranscriptionJob.updateMany({
                where: {
                    id: candidate.id,
                    OR: [
                        {
                            status: VoiceTranscriptionJobStatus.PENDING,
                            runAfter: { lte: now },
                        },
                        {
                            status: VoiceTranscriptionJobStatus.PROCESSING,
                            lockedAt: { lt: staleBefore },
                        },
                    ],
                },
                data: {
                    status: VoiceTranscriptionJobStatus.PROCESSING,
                    startedAt: candidate.attemptCount === 0 ? now : undefined,
                    lockedAt: now,
                    lockedBy: VOICE_JOB_WORKER_ID,
                    lastError: null,
                },
            });

            if (updated.count > 0) {
                claimed.push(candidate);
            }
        }

        return claimed;
    }

    private async finalizeJob(jobId: string, data: Prisma.VoiceTranscriptionJobUpdateManyMutationInput) {
        await prisma.voiceTranscriptionJob.updateMany({
            where: {
                id: jobId,
                status: VoiceTranscriptionJobStatus.PROCESSING,
                lockedBy: VOICE_JOB_WORKER_ID,
            },
            data,
        });
    }

    private async rescheduleJob(job: VoiceTranscriptionJobRecord, reason: string) {
        const attemptCount = job.attemptCount + 1;
        const maxAttempts = Math.max(1, job.maxAttempts || VOICE_JOB_MAX_ATTEMPTS);
        const exhausted = attemptCount >= maxAttempts;

        if (exhausted) {
            await this.finalizeJob(job.id, {
                status: VoiceTranscriptionJobStatus.FAILED,
                attemptCount,
                lastError: reason.slice(0, 4000),
                lockedAt: null,
                lockedBy: null,
            });
            return;
        }

        const retryDelayMs = Math.min(15 * 60 * 1000, Math.pow(2, Math.max(0, attemptCount - 1)) * 15000);
        await this.finalizeJob(job.id, {
            status: VoiceTranscriptionJobStatus.PENDING,
            attemptCount,
            runAfter: new Date(Date.now() + retryDelayMs),
            lastError: reason.slice(0, 4000),
            lockedAt: null,
            lockedBy: null,
        });
    }

    private async fetchAudioBuffer(audioUrl: string) {
        const response = await axios.get<ArrayBuffer>(audioUrl, {
            responseType: 'arraybuffer',
            timeout: VOICE_AUDIO_FETCH_TIMEOUT_MS,
            maxContentLength: MAX_AUDIO_FETCH_BYTES,
            maxBodyLength: MAX_AUDIO_FETCH_BYTES,
        });

        return Buffer.from(response.data);
    }

    private parseTranscript(value: Prisma.JsonValue): VoiceTranscriptionResult | null {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            return null;
        }

        const record = value as Record<string, unknown>;
        if (typeof record.rawTranscript !== 'string' || typeof record.cleanTranscript !== 'string') {
            return null;
        }

        return record as unknown as VoiceTranscriptionResult;
    }

    private async syncCompletedTranscriptToEntry(
        job: NonNullable<Awaited<ReturnType<typeof prisma.voiceTranscriptionJob.findFirst>>>
    ) {
        if (!job.entryId) {
            return;
        }

        const transcript = this.parseTranscript(job.transcript);
        const payload = parseJobPayload(job.payload);
        if (!transcript || !payload) {
            return;
        }

        const entry = await prisma.entry.findFirst({
            where: {
                id: job.entryId,
                userId: job.userId,
            },
            select: {
                id: true,
                title: true,
                content: true,
                audioUrl: true,
                analysis: true,
            },
        });

        if (!entry) {
            return;
        }

        const cleanTranscript = transcript.cleanTranscript.trim();
        const normalizedCurrentContent = normalizeComparisonText(entry.content);
        const normalizedPreviewText = normalizeComparisonText(payload.previewText);
        const normalizedCleanTranscript = normalizeComparisonText(cleanTranscript);
        const shouldReplaceContent = Boolean(cleanTranscript) && (
            !normalizedCurrentContent
            || (normalizedPreviewText && normalizedCurrentContent === normalizedPreviewText)
        );

        const baseAnalysis = isJsonObject(entry.analysis) ? entry.analysis : {};
        const existingVoice = isJsonObject(baseAnalysis.voice) ? baseAnalysis.voice : {};
        const nextVoiceAnalysis: Prisma.JsonObject = {
            ...existingVoice,
            rawTranscript: transcript.rawTranscript,
            cleanTranscript: transcript.cleanTranscript,
            detectedLanguage: transcript.detectedLanguage ?? existingVoice.detectedLanguage ?? null,
            providers: mergeUniqueStrings(
                toStringArray(existingVoice.providers),
                transcript.providerMeta?.provider ? [transcript.providerMeta.provider] : []
            ),
            models: mergeUniqueStrings(
                toStringArray(existingVoice.models),
                transcript.providerMeta?.model ? [transcript.providerMeta.model] : []
            ),
            sources: mergeUniqueStrings(
                toStringArray(existingVoice.sources),
                transcript.source ? [transcript.source] : []
            ),
            reviewRequired: transcript.reviewRequired,
            confidenceOverall:
                typeof transcript.confidence?.overall === 'number'
                    ? transcript.confidence.overall
                    : typeof existingVoice.confidenceOverall === 'number'
                        ? existingVoice.confidenceOverall
                        : null,
            clipCount: typeof existingVoice.clipCount === 'number'
                ? Math.max(existingVoice.clipCount, 1)
                : 1,
            captureMeta: job.captureMeta || existingVoice.captureMeta || null,
            transcriptionJobId: job.id,
            transcriptionStatus: job.status,
            transcriptionProvider: transcript.providerMeta?.provider || job.provider || null,
            transcriptionModel: transcript.providerMeta?.model || job.model || null,
            transcriptionLanguageMode: job.languageMode,
            transcriptionLastError: null,
            finalizedAt: new Date().toISOString(),
        };

        let mergedAnalysis: Prisma.JsonObject = {
            ...baseAnalysis,
            voice: nextVoiceAnalysis,
        };

        let nlpAnalysis: AnalysisResult | null = null;
        const nextContent = shouldReplaceContent ? cleanTranscript : entry.content;

        if (shouldReplaceContent && nextContent.trim() && normalizedCurrentContent !== normalizedCleanTranscript) {
            try {
                nlpAnalysis = await nlpService.analyzeContent(nextContent, {
                    title: entry.title || undefined,
                    userId: job.userId,
                });
                mergedAnalysis = mergeNlpInsightsIntoAnalysis(mergedAnalysis, nlpAnalysis);
            } catch (error: any) {
                serverLogger.warn('voice.job.entry_analysis_failed', {
                    jobId: job.id,
                    entryId: entry.id,
                    userId: job.userId,
                    reason: error?.message || 'Unknown NLP failure',
                });
            }
        }

        await prisma.entry.update({
            where: { id: entry.id },
            data: {
                ...(shouldReplaceContent
                    ? {
                        content: nextContent,
                        contentHtml: null,
                    }
                    : {}),
                ...(!entry.audioUrl && job.audioUrl
                    ? {
                        audioUrl: job.audioUrl,
                    }
                    : {}),
                analysis: mergedAnalysis as Prisma.InputJsonValue,
            },
        });

        if (nlpAnalysis) {
            await upsertEntryAnalysisFromNlp({
                entryId: entry.id,
                userId: job.userId,
                content: nextContent,
                analysis: nlpAnalysis,
            });
        }
    }

    private async processVoiceTranscriptionJob(job: VoiceTranscriptionJobRecord) {
        const payload = parseJobPayload(job.payload);

        if (!payload) {
            await this.finalizeJob(job.id, {
                status: VoiceTranscriptionJobStatus.FAILED,
                attemptCount: job.attemptCount + 1,
                lastError: 'Invalid voice transcription job payload.',
                lockedAt: null,
                lockedBy: null,
            });
            return;
        }

        try {
            const [audioBuffer, lexiconHints] = await Promise.all([
                this.fetchAudioBuffer(payload.audioUrl),
                voiceLexiconService.getHintsForUser(job.userId, payload.candidateLanguages),
            ]);

            const transcript = await voiceTranscriptionService.transcribe({
                audioBuffer,
                filename: payload.fileName || 'voice-note.webm',
                mimeType: payload.mimeType,
                languageMode: payload.languageMode,
                hintText: payload.hintText,
                entryContext: payload.entryContext,
                userId: job.userId,
                candidateLanguages: payload.candidateLanguages,
                lexiconHints,
                captureMeta: payload.captureMeta || undefined,
            });

            await this.finalizeJob(job.id, {
                status: VoiceTranscriptionJobStatus.COMPLETED,
                transcript: cloneJson(transcript) as Prisma.InputJsonValue,
                provider: transcript.providerMeta.provider,
                model: transcript.providerMeta.model,
                detectedLanguage: transcript.detectedLanguage,
                completedAt: new Date(),
                lastError: null,
                lockedAt: null,
                lockedBy: null,
            });

            const completedJob = await this.getJobForUser(job.id, job.userId);
            if (completedJob) {
                await this.syncCompletedTranscriptToEntry(completedJob);
            }

            await voiceLexiconService.markHintsUsed(job.userId, lexiconHints);
        } catch (error: any) {
            const reason = error?.message || 'Unknown voice transcription failure';
            serverLogger.warn('voice.job.failed', {
                jobId: job.id,
                userId: job.userId,
                attemptCount: job.attemptCount + 1,
                reason,
            });
            await this.rescheduleJob(job, reason);
        }
    }

    private async drainVoiceTranscriptionJobs() {
        if (this.isDrainingJobs) {
            return;
        }

        this.isDrainingJobs = true;
        try {
            while (true) {
                const jobs = await this.claimPendingJobs(VOICE_JOB_BATCH_SIZE);
                if (jobs.length === 0) {
                    break;
                }

                for (const job of jobs) {
                    await this.processVoiceTranscriptionJob(job);
                }
            }
        } finally {
            this.isDrainingJobs = false;
        }
    }

    toClientPayload(job: Awaited<ReturnType<typeof prisma.voiceTranscriptionJob.findFirst>>) {
        if (!job) return null;

        return {
            id: job.id,
            entryId: job.entryId,
            audioUrl: job.audioUrl,
            fileName: job.fileName,
            mimeType: job.mimeType,
            languageMode: job.languageMode,
            candidateLanguages: job.candidateLanguages,
            recordingDurationMs: job.recordingDurationMs,
            hintText: job.hintText,
            entryContext: job.entryContext,
            status: job.status,
            provider: job.provider,
            model: job.model,
            detectedLanguage: job.detectedLanguage,
            attemptCount: job.attemptCount,
            maxAttempts: job.maxAttempts,
            lastError: job.lastError,
            createdAt: job.createdAt,
            updatedAt: job.updatedAt,
            startedAt: job.startedAt,
            completedAt: job.completedAt,
            canceledAt: job.canceledAt,
            captureMeta: job.captureMeta,
            transcript: this.parseTranscript(job.transcript),
        };
    }
}

export const voiceTranscriptionJobService = new VoiceTranscriptionJobService();

export default voiceTranscriptionJobService;
