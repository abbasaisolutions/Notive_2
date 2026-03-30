import axios from 'axios';
import OpenAI from 'openai';
import { aiRuntime, getOpenAiClient } from '../config/ai';
import { serverLogger } from '../utils/server-logger';
import type { VoiceLexiconHint } from './voice-lexicon.service';

export type VoiceLanguageMode =
    | 'auto'
    | 'en'
    | 'es'
    | 'fr'
    | 'ar'
    | 'ur'
    | 'pa'
    | 'hi'
    | 'bn'
    | 'fa'
    | 'tr'
    | 'de'
    | 'pt'
    | 'it'
    | 'zh'
    | 'ja'
    | 'ko'
    | 'en-ur'
    | 'en-pa'
    | 'en-ar'
    | 'other';

export type VoiceTranscriptionInput = {
    audioBuffer: Buffer;
    filename: string;
    mimeType: string;
    languageMode: VoiceLanguageMode;
    hintText?: string | null;
    entryContext?: string | null;
    requestId?: string | null;
    userId?: string | null;
    candidateLanguages?: string[];
    lexiconHints?: VoiceLexiconHint[];
    captureMeta?: Record<string, unknown> | null;
};

export type VoiceTranscriptionResult = {
    rawTranscript: string;
    cleanTranscript: string;
    detectedLanguage: string | null;
    source: 'backend_transcribe';
    reviewRequired: boolean;
    confidence?: {
        overall?: number;
        lowConfidenceSpans?: Array<{
            start: number;
            end: number;
            text: string;
        }>;
    };
    providerMeta: {
        provider: 'openai' | 'faster_whisper';
        model: string;
        latencyMs: number;
    };
};

type VoiceTranscriptionError = Error & {
    code?: string;
    retryable?: boolean;
    statusCode?: number;
};

type LocalServiceResponse = {
    text?: string;
    cleanText?: string;
    detectedLanguage?: string | null;
    model?: string;
    confidenceOverall?: number;
    lowConfidenceSpans?: Array<{
        start?: number;
        end?: number;
        text?: string;
    }>;
};

type VoiceProvider = 'openai' | 'faster_whisper';

const MAX_HINT_LENGTH = 240;
const LOCAL_PROVIDER = 'faster_whisper';
const OPENAI_PROVIDER = 'openai';
const localServiceUrl = (process.env.VOICE_LOCAL_SERVICE_URL || '').trim().replace(/\/$/, '');
const localServiceTimeoutMs = Number.parseInt(process.env.VOICE_LOCAL_SERVICE_TIMEOUT_MS || '120000', 10);

const normalizeOptionalText = (value: unknown, maxLength = MAX_HINT_LENGTH): string | null => {
    if (typeof value !== 'string') return null;
    const normalized = value.replace(/\s+/g, ' ').trim();
    return normalized ? normalized.slice(0, maxLength) : null;
};

const resolveConfiguredProvider = (): VoiceProvider => {
    const configured = (process.env.VOICE_BACKEND_PROVIDER || '').trim().toLowerCase();
    if (configured === LOCAL_PROVIDER || configured === OPENAI_PROVIDER) {
        return configured;
    }

    if (localServiceUrl) {
        return LOCAL_PROVIDER;
    }

    return OPENAI_PROVIDER;
};

const resolveLanguage = (mode: VoiceLanguageMode): string | undefined => {
    if (mode === 'auto' || mode === 'other') return undefined;
    if (mode.includes('-')) {
        return undefined;
    }
    return mode;
};

const resolveCandidateLanguages = (
    mode: VoiceLanguageMode,
    candidateLanguages: string[] | undefined
) => {
    const normalizedCandidates = Array.from(
        new Set(
            (candidateLanguages || [])
                .map((value) => String(value || '').trim().toLowerCase())
                .filter(Boolean)
        )
    );

    if (normalizedCandidates.length > 0) {
        return normalizedCandidates;
    }

    switch (mode) {
        case 'en-ur':
            return ['en', 'ur'];
        case 'en-pa':
            return ['en', 'pa'];
        case 'en-ar':
            return ['en', 'ar'];
        case 'auto':
        case 'other':
            return [];
        default:
            return [mode];
    }
};

const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1);

const deriveOverallConfidence = (logprobs: Array<{ logprob?: number }> | undefined): number | undefined => {
    const numeric = (logprobs || [])
        .map((item) => Number(item?.logprob))
        .filter((value) => Number.isFinite(value)) as number[];

    if (numeric.length === 0) return undefined;

    const average = numeric.reduce((sum, value) => sum + value, 0) / numeric.length;
    return clamp01(Math.exp(average));
};

const capitalizeSentenceStarts = (text: string): string =>
    text.replace(/(^|[.!?]\s+|\n)([a-z])/g, (_, prefix: string, letter: string) => `${prefix}${letter.toUpperCase()}`);

const COMMON_REPLACEMENTS: Array<[RegExp, string]> = [
    [/\bdont\b/gi, "don't"],
    [/\bcant\b/gi, "can't"],
    [/\bwont\b/gi, "won't"],
    [/\bim\b/gi, "I'm"],
    [/\bive\b/gi, "I've"],
    [/\bidk\b/gi, "I don't know"],
];

const polishTranscript = (input: string): string => {
    let text = input.replace(/\r\n/g, '\n');
    text = text
        .split('\n')
        .map((line) => line.replace(/[ \t]+$/g, ''))
        .join('\n');

    text = text.replace(/[ \t]{2,}/g, ' ');
    text = text.replace(/\n{3,}/g, '\n\n');
    text = text.replace(/\s+([,.;!?])/g, '$1');
    text = text.replace(/([,.;!?])([^\s\n])/g, '$1 $2');
    text = text.replace(/([!?]){2,}/g, '$1');
    text = text.replace(/\.{4,}/g, '...');
    text = text.replace(/,{2,}/g, ',');
    text = text.replace(/(^|[^A-Za-z])i('m|'ve|'ll|'d)?(?=[^A-Za-z]|$)/g, (_, prefix: string, suffix: string = '') => `${prefix}I${suffix}`);

    for (const [pattern, replacement] of COMMON_REPLACEMENTS) {
        text = text.replace(pattern, replacement);
    }

    return capitalizeSentenceStarts(text).trim();
};

const buildPrompt = (
    hintText?: string | null,
    entryContext?: string | null,
    candidateLanguages: string[] = [],
    lexiconHints: VoiceLexiconHint[] = []
): string | undefined => {
    const lexiconTerms = Array.from(
        new Set(
            lexiconHints
                .flatMap((hint) => [hint.canonical, ...(hint.aliases || [])])
                .map((value) => normalizeOptionalText(value, 80))
                .filter((value): value is string => Boolean(value))
        )
    ).slice(0, 20);

    const parts = [
        normalizeOptionalText(hintText),
        normalizeOptionalText(entryContext, 140),
        candidateLanguages.length > 0
            ? `Possible languages: ${candidateLanguages.join(', ')}.`
            : null,
        lexiconTerms.length > 0
            ? `Preserve exact spellings for: ${lexiconTerms.join(', ')}.`
            : null,
    ].filter((part): part is string => Boolean(part));

    return parts.length > 0 ? parts.join(' | ') : undefined;
};

const createVoiceError = (
    code: string,
    message: string,
    options: { retryable?: boolean; statusCode?: number } = {}
): VoiceTranscriptionError => {
    const error = new Error(message) as VoiceTranscriptionError;
    error.code = code;
    error.retryable = options.retryable ?? false;
    error.statusCode = options.statusCode ?? 500;
    return error;
};

class VoiceTranscriptionService {
    private getClient(): OpenAI {
        const client = getOpenAiClient();
        if (!client) {
            throw createVoiceError(
                'VOICE_PROVIDER_UNAVAILABLE',
                'Voice transcription is not configured for this environment.',
                { retryable: false, statusCode: 503 }
            );
        }

        return client;
    }

    private getProvider(): VoiceProvider {
        if (process.env.VOICE_BACKEND_TRANSCRIPTION_ENABLED === 'false') {
            throw createVoiceError(
                'VOICE_TRANSCRIPTION_DISABLED',
                'Voice transcription is currently disabled.',
                { retryable: false, statusCode: 503 }
            );
        }

        const provider = resolveConfiguredProvider();
        if (provider === LOCAL_PROVIDER && !localServiceUrl) {
            throw createVoiceError(
                'VOICE_LOCAL_PROVIDER_UNAVAILABLE',
                'Local voice transcription service is not configured.',
                { retryable: true, statusCode: 503 }
            );
        }

        return provider;
    }

    async transcribe(input: VoiceTranscriptionInput): Promise<VoiceTranscriptionResult> {
        const provider = this.getProvider();
        const startedAt = Date.now();
        const candidateLanguages = resolveCandidateLanguages(input.languageMode, input.candidateLanguages);
        const lexiconHints = input.lexiconHints || [];

        try {
            const result = provider === LOCAL_PROVIDER
                ? await this.transcribeWithLocalService(input, candidateLanguages, lexiconHints, startedAt)
                : await this.transcribeWithOpenAi(input, candidateLanguages, lexiconHints, startedAt);

            serverLogger.info('voice.transcription.succeeded', {
                requestId: input.requestId || undefined,
                userId: input.userId || undefined,
                provider: result.providerMeta.provider,
                model: result.providerMeta.model,
                latencyMs: result.providerMeta.latencyMs,
                languageMode: input.languageMode,
                detectedLanguage: result.detectedLanguage || undefined,
                confidenceOverall: result.confidence?.overall,
                reviewRequired: result.reviewRequired,
                candidateLanguages,
            });

            return result;
        } catch (error: any) {
            const wrapped = this.normalizeProviderError(error);
            serverLogger.warn('voice.transcription.failed', {
                requestId: input.requestId || undefined,
                userId: input.userId || undefined,
                provider,
                model: provider === LOCAL_PROVIDER ? 'faster-whisper' : aiRuntime.voiceTranscriptionModel,
                latencyMs: Date.now() - startedAt,
                code: wrapped.code || 'VOICE_TRANSCRIPTION_FAILED',
                retryable: wrapped.retryable ?? false,
                statusCode: wrapped.statusCode || 500,
                message: wrapped.message,
            });
            throw wrapped;
        }
    }

    private async transcribeWithOpenAi(
        input: VoiceTranscriptionInput,
        candidateLanguages: string[],
        lexiconHints: VoiceLexiconHint[],
        startedAt: number
    ): Promise<VoiceTranscriptionResult> {
        const client = this.getClient();
        const file = await OpenAI.toFile(input.audioBuffer, input.filename, { type: input.mimeType });
        const response = await client.audio.transcriptions.create({
            file,
            model: aiRuntime.voiceTranscriptionModel,
            language: resolveLanguage(input.languageMode),
            prompt: buildPrompt(input.hintText, input.entryContext, candidateLanguages, lexiconHints),
            response_format: 'json',
            include: ['logprobs'],
            temperature: 0,
        });

        const rawTranscript = String(response.text || '').trim();
        if (!rawTranscript) {
            throw createVoiceError(
                'VOICE_EMPTY_TRANSCRIPT',
                'No transcript was returned for this recording.',
                { retryable: true, statusCode: 502 }
            );
        }

        const confidenceOverall = deriveOverallConfidence(response.logprobs);
        return {
            rawTranscript,
            cleanTranscript: polishTranscript(rawTranscript),
            detectedLanguage: resolveLanguage(input.languageMode) || candidateLanguages[0] || null,
            source: 'backend_transcribe',
            reviewRequired: confidenceOverall !== undefined ? confidenceOverall < 0.72 : false,
            confidence: confidenceOverall !== undefined ? { overall: confidenceOverall } : undefined,
            providerMeta: {
                provider: OPENAI_PROVIDER,
                model: aiRuntime.voiceTranscriptionModel,
                latencyMs: Date.now() - startedAt,
            },
        };
    }

    private async transcribeWithLocalService(
        input: VoiceTranscriptionInput,
        candidateLanguages: string[],
        lexiconHints: VoiceLexiconHint[],
        startedAt: number
    ): Promise<VoiceTranscriptionResult> {
        const response = await axios.post<LocalServiceResponse>(`${localServiceUrl}/transcribe`, {
            audioBase64: input.audioBuffer.toString('base64'),
            fileName: input.filename,
            mimeType: input.mimeType,
            languageMode: input.languageMode,
            candidateLanguages,
            hintText: normalizeOptionalText(input.hintText),
            entryContext: normalizeOptionalText(input.entryContext, 140),
            lexiconHints,
            captureMeta: input.captureMeta || null,
        }, {
            timeout: Number.isFinite(localServiceTimeoutMs) ? localServiceTimeoutMs : 120000,
        });

        const rawTranscript = String(response.data?.text || '').trim();
        if (!rawTranscript) {
            throw createVoiceError(
                'VOICE_EMPTY_TRANSCRIPT',
                'No transcript was returned for this recording.',
                { retryable: true, statusCode: 502 }
            );
        }

        const confidenceOverall = Number(response.data?.confidenceOverall);
        const lowConfidenceSpans = Array.isArray(response.data?.lowConfidenceSpans)
            ? response.data.lowConfidenceSpans
                .map((span) => ({
                    start: Number(span?.start),
                    end: Number(span?.end),
                    text: String(span?.text || '').trim(),
                }))
                .filter((span) =>
                    Number.isFinite(span.start)
                    && Number.isFinite(span.end)
                    && span.end >= span.start
                    && span.text.length > 0
                )
            : undefined;

        const overall = Number.isFinite(confidenceOverall)
            ? clamp01(confidenceOverall)
            : undefined;

        return {
            rawTranscript,
            cleanTranscript: polishTranscript(String(response.data?.cleanText || rawTranscript)),
            detectedLanguage: normalizeOptionalText(response.data?.detectedLanguage, 32),
            source: 'backend_transcribe',
            reviewRequired: (overall !== undefined && overall < 0.8) || Boolean(lowConfidenceSpans && lowConfidenceSpans.length > 0),
            confidence: overall !== undefined || lowConfidenceSpans
                ? {
                    ...(overall !== undefined ? { overall } : {}),
                    ...(lowConfidenceSpans ? { lowConfidenceSpans } : {}),
                }
                : undefined,
            providerMeta: {
                provider: LOCAL_PROVIDER,
                model: normalizeOptionalText(response.data?.model, 128) || 'faster-whisper',
                latencyMs: Date.now() - startedAt,
            },
        };
    }

    private normalizeProviderError(error: any): VoiceTranscriptionError {
        if (error?.code && error?.statusCode) {
            return error as VoiceTranscriptionError;
        }

        const responseStatus = Number.isInteger(error?.response?.status) ? error.response.status : null;
        const statusCode = Number.isInteger(error?.status) ? error.status : (responseStatus || 500);
        const providerMessage = typeof error?.response?.data?.detail === 'string'
            ? error.response.data.detail
            : typeof error?.response?.data?.message === 'string'
                ? error.response.data.message
                : null;
        const code = typeof error?.code === 'string'
            ? error.code
            : statusCode === 429
                ? 'VOICE_PROVIDER_RATE_LIMITED'
                : statusCode >= 500
                    ? 'VOICE_PROVIDER_ERROR'
                    : 'VOICE_TRANSCRIPTION_FAILED';
        const retryable = statusCode === 429 || statusCode >= 500;
        const message = providerMessage
            || (typeof error?.message === 'string' && error.message.trim()
                ? error.message
                : 'Voice transcription failed.');

        return createVoiceError(code, message, { retryable, statusCode });
    }
}

export const voiceTranscriptionService = new VoiceTranscriptionService();

export default voiceTranscriptionService;
