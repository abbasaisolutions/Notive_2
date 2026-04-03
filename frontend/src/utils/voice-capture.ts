import { DEFAULT_VOICE_LANGUAGE_MODE, PENDING_VOICE_CAPTURE_KEY } from '@/constants/voice';
import type {
    VoiceCaptureSource,
    VoiceCaptureQualityMetrics,
    VoiceTranscriptionJob,
    VoiceLanguageMode,
    VoiceTranscriptionResponse,
} from '@/services/voice-transcription.service';
import { polishEntryText } from '@/utils/writing-assistant';

export type VoiceCaptureState = {
    rawTranscript: string;
    cleanTranscript: string;
    detectedLanguage: string | null;
    providers: string[];
    models: string[];
    sources: VoiceCaptureSource[];
    reviewRequired: boolean;
    confidenceOverall: number | null;
    clipCount: number;
    captureMeta?: VoiceCaptureQualityMetrics | null;
};

export type PendingVoiceCapture = VoiceTranscriptionResponse & {
    jobId?: string | null;
    previewText?: string | null;
    languageMode?: VoiceLanguageMode;
    pendingJob?: VoiceTranscriptionJob | null;
    audioUrl: string | null;
};

export type StagedVoiceCapture = {
    transcript?: VoiceTranscriptionResponse | null;
    jobId?: string | null;
    previewText?: string | null;
    languageMode?: VoiceLanguageMode;
    pendingJob?: VoiceTranscriptionJob | null;
    captureMeta?: VoiceCaptureQualityMetrics | null;
    audioUrl: string | null;
};

const VOICE_RECORDER_MIME_CANDIDATES = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/mpeg',
] as const;

const pickSupportedVoiceRecorderMimeType = (): string => {
    if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
        return '';
    }

    const supported = VOICE_RECORDER_MIME_CANDIDATES.find((candidate) => {
        try {
            return MediaRecorder.isTypeSupported(candidate);
        } catch {
            return false;
        }
    });

    return supported || '';
};

export const normalizeRecordedAudioMimeType = (value: string | null | undefined): string => {
    const baseType = String(value || '')
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
            return baseType || 'audio/webm';
    }
};

export const getVoiceRecordingFilename = (mimeType: string | null | undefined): string => {
    switch (normalizeRecordedAudioMimeType(mimeType)) {
        case 'audio/mp4':
            return 'voice-note.m4a';
        case 'audio/mpeg':
            return 'voice-note.mp3';
        case 'audio/wav':
            return 'voice-note.wav';
        case 'audio/ogg':
            return 'voice-note.ogg';
        default:
            return 'voice-note.webm';
    }
};

export const createVoiceMediaRecorder = (stream: MediaStream): MediaRecorder => {
    const mimeType = pickSupportedVoiceRecorderMimeType();
    return mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
};

const appendSegment = (existing: string, next: string) => {
    const normalizedNext = next.trim();
    if (!normalizedNext) return existing;
    const normalizedExisting = existing.trim();
    if (!normalizedExisting) return normalizedNext;
    return `${normalizedExisting}\n\n${normalizedNext}`;
};

const mergeUnique = (items: string[], nextItem?: string | null) =>
    nextItem && nextItem.trim()
        ? Array.from(new Set([...items, nextItem.trim()]))
        : items;

export const getSpeechPreviewLocale = (languageMode: VoiceLanguageMode = DEFAULT_VOICE_LANGUAGE_MODE): string => {
    switch (languageMode) {
        case 'es':
            return 'es-ES';
        case 'fr':
            return 'fr-FR';
        case 'ar':
            return 'ar-SA';
        case 'ur':
            return 'ur-PK';
        case 'pa':
        case 'en-pa':
            return 'pa-PK';
        case 'en-ur':
            return 'ur-PK';
        case 'en-ar':
            return 'ar-SA';
        case 'en':
            return 'en-US';
        default:
            return 'en-US';
    }
};

export const buildBrowserFallbackTranscription = (
    transcript: string,
    languageMode: VoiceLanguageMode = DEFAULT_VOICE_LANGUAGE_MODE
): VoiceTranscriptionResponse => {
    const rawTranscript = transcript.trim();
    return {
        rawTranscript,
        cleanTranscript: polishEntryText(rawTranscript),
        detectedLanguage: languageMode === 'auto' || languageMode === 'other' ? null : languageMode,
        source: 'browser_fallback',
        reviewRequired: true,
        captureMeta: null,
        providerMeta: {
            provider: 'browser',
            model: 'SpeechRecognition',
            latencyMs: 0,
        },
    };
};

export const toVoiceCaptureState = (result: VoiceTranscriptionResponse): VoiceCaptureState => ({
    rawTranscript: result.rawTranscript.trim(),
    cleanTranscript: result.cleanTranscript.trim(),
    detectedLanguage: result.detectedLanguage,
    providers: result.providerMeta?.provider ? [result.providerMeta.provider] : [],
    models: result.providerMeta?.model ? [result.providerMeta.model] : [],
    sources: [result.source],
    reviewRequired: result.reviewRequired,
    confidenceOverall: typeof result.confidence?.overall === 'number' ? result.confidence.overall : null,
    clipCount: 1,
    captureMeta: result.captureMeta || null,
});

export const mergeVoiceCaptureState = (
    current: VoiceCaptureState | null,
    result: VoiceTranscriptionResponse
): VoiceCaptureState => {
    if (!current) {
        return toVoiceCaptureState(result);
    }

    const nextConfidence = typeof result.confidence?.overall === 'number' ? result.confidence.overall : null;

    return {
        rawTranscript: appendSegment(current.rawTranscript, result.rawTranscript),
        cleanTranscript: appendSegment(current.cleanTranscript, result.cleanTranscript),
        detectedLanguage: result.detectedLanguage || current.detectedLanguage,
        providers: mergeUnique(current.providers, result.providerMeta?.provider),
        models: mergeUnique(current.models, result.providerMeta?.model),
        sources: Array.from(new Set([...current.sources, result.source])) as VoiceCaptureSource[],
        reviewRequired: current.reviewRequired || result.reviewRequired,
        confidenceOverall: nextConfidence ?? current.confidenceOverall,
        clipCount: current.clipCount + 1,
        captureMeta: result.captureMeta || current.captureMeta || null,
    };
};

export const stagePendingVoiceCapture = (payload: StagedVoiceCapture) => {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem(PENDING_VOICE_CAPTURE_KEY, JSON.stringify(payload));
};

export const takePendingVoiceCapture = (): StagedVoiceCapture | null => {
    if (typeof window === 'undefined') return null;
    const raw = sessionStorage.getItem(PENDING_VOICE_CAPTURE_KEY);
    if (!raw) return null;

    sessionStorage.removeItem(PENDING_VOICE_CAPTURE_KEY);
    try {
        return JSON.parse(raw) as StagedVoiceCapture;
    } catch (error) {
        console.error('Failed to parse pending voice capture', error);
        return null;
    }
};
