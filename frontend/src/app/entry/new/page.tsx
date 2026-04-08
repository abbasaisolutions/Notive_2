'use client';

import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useApi from '@/hooks/use-api';
import useAuthRedirect from '@/hooks/use-auth-redirect';
import { StructuredEntryData } from '@/services/structured-data.service';
import useEntryDraft from '@/hooks/use-entry-draft';
import useEntryAnalysis from '@/hooks/use-entry-analysis';
import useContextNavigation from '@/hooks/use-context-navigation';
import useSpeechRecognition from '@/hooks/use-speech-recognition';
import useUploadQueue from '@/hooks/use-upload-queue';
import useTelemetry from '@/hooks/use-telemetry';
import { API_URL } from '@/constants/config';
import { DEFAULT_VOICE_LANGUAGE_MODE, VOICE_ALLOW_BROWSER_FALLBACK, VOICE_BACKEND_TRANSCRIPTION_ENABLED } from '@/constants/voice';
import { useGamification } from '@/context/gamification-context';
import { useRouter, useSearchParams } from 'next/navigation';
import EntryTopBar from '@/components/entry/new/EntryTopBar';
import EntryEditorCard from '@/components/entry/new/EntryEditorCard';
import FloatingRecordBar from '@/components/entry/new/FloatingRecordBar';
import EntryInsightsPanel from '@/components/entry/new/EntryInsightsPanel';
import {
    attachVoiceTranscriptionJob,
    createVoiceTranscriptionJob,
    getVoiceTranscriptionJob,
    type VoiceCaptureQualityMetrics,
    type VoiceTranscriptionJob,
    type VoiceTranscriptionResponse,
} from '@/services/voice-transcription.service';
import { appendReturnTo } from '@/utils/navigation';
import { normalizeTag, isValidTag } from '@/utils/tags';
import { useToast } from '@/context/toast-context';
import { usePushNotifications } from '@/context/push-notification-context';
import { Spinner } from '@/components/ui';
import FirstEntryHandoff from '@/components/entry/FirstEntryHandoff';
import { prepareImageForUpload } from '@/utils/image-upload';
import {
    buildBrowserFallbackTranscription,
    createVoiceMediaRecorder,
    getVoiceStartErrorMessage,
    getVoiceRecordingFilename,
    getSpeechPreviewLocale,
    mergeVoiceCaptureState,
    normalizeRecordedAudioMimeType,
    requestVoiceRecordingStream,
    takePendingVoiceCapture,
    toVoiceCaptureState,
    type VoiceCaptureState,
} from '@/utils/voice-capture';
import createVoiceCaptureMonitor from '@/utils/voice-capture-metrics';
import { getStarterPrompt, getWritingSuggestions, polishEntryText, polishTitle } from '@/utils/writing-assistant';
import {
    GENTLE_REFLECTION_ID_PARAM,
    GENTLE_REFLECTION_SOURCE,
    GENTLE_REFLECTION_TAGS_PARAM,
    markGentleReflectionCompleted,
    parseGentleReflectionTags,
} from '@/utils/gentle-reflection';
import {
    DEFAULT_LIFE_AREA_BY_CATEGORY,
    LIFE_AREA_OPTIONS,
    EntryCategory,
    normalizeCategory,
    normalizeLifeArea,
} from '@/constants/life-areas';
import { captureEntryLocation, type EntryLocation } from '@/services/location-context.service';
import { captureDeviceSnapshot, type DeviceSnapshot } from '@/services/device-context.service';
import { hapticSuccess, hapticError, hapticTap, hapticWarning } from '@/services/haptics.service';
import type { IconType } from 'react-icons';
import {
    FiAlertCircle,
    FiAlertTriangle,
    FiFrown,
    FiHelpCircle,
    FiSmile,
    FiSun,
    FiZap,
} from 'react-icons/fi';

const MOODS = [
    { icon: FiSmile, label: 'Happy', value: 'happy' },
    { icon: FiSun, label: 'Calm', value: 'calm' },
    { icon: FiFrown, label: 'Sad', value: 'sad' },
    { icon: FiAlertCircle, label: 'Anxious', value: 'anxious' },
    { icon: FiHelpCircle, label: 'Thoughtful', value: 'thoughtful' },
] satisfies Array<{ icon: IconType; label: string; value: string }>;

type DraftConflict = {
    seededText: string;
    seededAudioUrl: string | null;
    seededTags: string[];
    seededVoiceCapture: VoiceCaptureState | null;
};

type CollectionOption = {
    id: string;
    name: string;
};

type DuplicateCandidate = {
    id: string;
    title: string | null;
    contentPreview: string;
    mood: string | null;
    tags: string[];
    createdAt: string;
    semanticScore: number;
    rerankScore: number | null;
    relevance: number;
    lexicalOverlap: number;
    duplicateKind: 'near_duplicate' | 'written_before';
    matchReasons: string[];
};

const mergeUniqueTags = (base: string[], extras: string[]) =>
    Array.from(
        new Set(
            [...base, ...extras]
                .map((item) => item.replace(/\s+/g, ' ').trim())
                .filter(Boolean)
        )
    ).slice(0, 12);

const appendVoiceText = (existing: string, addition: string) => {
    const next = addition.trim();
    if (!next) return existing;
    if (!existing.trim()) return next;
    return `${existing.trim()} ${next}`.trim();
};

const resolveCandidateLanguages = (languageMode: 'auto' | string) => {
    switch (languageMode) {
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
            return [languageMode];
    }
};

const parseStoredVoiceCapture = (value: unknown): VoiceCaptureState | null => {
    if (!value || typeof value !== 'object') return null;

    const record = value as Record<string, unknown>;
    const rawTranscript = typeof record.rawTranscript === 'string' ? record.rawTranscript.trim() : '';
    const cleanTranscript = typeof record.cleanTranscript === 'string'
        ? record.cleanTranscript.trim()
        : rawTranscript;

    if (!rawTranscript && !cleanTranscript) return null;

    return {
        rawTranscript,
        cleanTranscript,
        detectedLanguage: typeof record.detectedLanguage === 'string' ? record.detectedLanguage : null,
        providers: Array.isArray(record.providers)
            ? record.providers.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
            : [],
        models: Array.isArray(record.models)
            ? record.models.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
            : [],
        sources: Array.isArray(record.sources)
            ? record.sources.filter(
                (item): item is VoiceCaptureState['sources'][number] =>
                    item === 'backend_transcribe' || item === 'browser_fallback'
            )
            : [],
        reviewRequired: Boolean(record.reviewRequired),
        confidenceOverall: typeof record.confidenceOverall === 'number' ? record.confidenceOverall : null,
        clipCount: typeof record.clipCount === 'number' && record.clipCount > 0 ? record.clipCount : 1,
        captureMeta: record.captureMeta && typeof record.captureMeta === 'object' && !Array.isArray(record.captureMeta)
            ? record.captureMeta as VoiceCaptureState['captureMeta']
            : null,
    };
};

const parseStoredVoiceJob = (value: unknown, audioUrl: string | null): VoiceTranscriptionJob | null => {
    if (!value || typeof value !== 'object') return null;
    const record = value as Record<string, unknown>;
    const id = typeof record.transcriptionJobId === 'string' ? record.transcriptionJobId.trim() : '';
    const status = typeof record.transcriptionStatus === 'string' ? record.transcriptionStatus.trim().toUpperCase() : '';

    if (!id || !status || !audioUrl) {
        return null;
    }

    if (!['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELED'].includes(status)) {
        return null;
    }

    return {
        id,
        entryId: null,
        audioUrl,
        fileName: null,
        mimeType: 'audio/webm',
        languageMode: typeof record.transcriptionLanguageMode === 'string' ? record.transcriptionLanguageMode : DEFAULT_VOICE_LANGUAGE_MODE,
        candidateLanguages: [],
        recordingDurationMs: null,
        hintText: null,
        entryContext: null,
        status: status as VoiceTranscriptionJob['status'],
        provider: typeof record.transcriptionProvider === 'string' ? record.transcriptionProvider : null,
        model: typeof record.transcriptionModel === 'string' ? record.transcriptionModel : null,
        detectedLanguage: typeof record.detectedLanguage === 'string' ? record.detectedLanguage : null,
        attemptCount: 0,
        maxAttempts: 4,
        lastError: typeof record.transcriptionLastError === 'string' ? record.transcriptionLastError : null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        startedAt: null,
        completedAt: null,
        canceledAt: null,
        captureMeta: record.captureMeta && typeof record.captureMeta === 'object' && !Array.isArray(record.captureMeta)
            ? record.captureMeta as VoiceCaptureState['captureMeta']
            : null,
        transcript: null,
    };
};

function NewEntryPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, isLoading: authLoading, isAuthenticated } = useAuthRedirect();
    const { awardXP, refreshStats } = useGamification();
    const { apiFetch } = useApi();
    const { trackEvent } = useTelemetry();
    const { enqueueUpload, processQueue, queueCount, recentUploads, clearUploadResult } = useUploadQueue();
    const { loadDraft, saveDraft, clearDraft } = useEntryDraft(user?.id ?? null);
    const { backHref, backLabel, navigateBack } = useContextNavigation('/dashboard', 'dashboard');
    const toast = useToast();
    const { isPermissionGranted: pushPermissionGranted, isLoading: pushLoading, requestPermission: requestPushPermission } = usePushNotifications();
    const pushAskedRef = useRef(false);
    const modeParam = searchParams.get('mode');
    const isQuickMode = modeParam !== 'full';
    const isWhisperRequested = modeParam === 'whisper';
    const isWhisperMode = isWhisperRequested || (!modeParam && new Date().getHours() >= 22);
    const entrySource = searchParams.get('source');
    const isGentleReflectionEntry = entrySource === GENTLE_REFLECTION_SOURCE;
    const gentleReflectionId = searchParams.get(GENTLE_REFLECTION_ID_PARAM) || '';
    const gentleReflectionTags = parseGentleReflectionTags(searchParams.get(GENTLE_REFLECTION_TAGS_PARAM));

    const [content, setContent] = useState('');
    const [contentHtml, setContentHtml] = useState('');
    const contentRef = useRef('');
    const [promptHint, setPromptHint] = useState<string | null>(null);

    const [titleOverride, setTitleOverride] = useState('');
    const [moodOverride, setMoodOverride] = useState<string | null>(null);
    const [tagsOverride, setTagsOverride] = useState<string[]>([]);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [category, setCategory] = useState<EntryCategory>('PERSONAL');
    const [lifeArea, setLifeArea] = useState<string>(DEFAULT_LIFE_AREA_BY_CATEGORY.PERSONAL);
    const [collectionId, setCollectionId] = useState<string | null>(null);
    const [collections, setCollections] = useState<CollectionOption[]>([]);
    const [voiceError, setVoiceError] = useState<string | null>(null);
    const [isVoiceProcessing, setIsVoiceProcessing] = useState(false);
    const [voiceCapture, setVoiceCapture] = useState<VoiceCaptureState | null>(null);
    const [voiceJob, setVoiceJob] = useState<VoiceTranscriptionJob | null>(null);
    const [duplicateCandidates, setDuplicateCandidates] = useState<DuplicateCandidate[]>([]);
    const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
    const [duplicateError, setDuplicateError] = useState('');

    const [isSaving, setIsSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [error, setError] = useState('');
    const [showAdvancedTools, setShowAdvancedTools] = useState(modeParam === 'full');
    const [entryId, setEntryId] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [draftRestored, setDraftRestored] = useState(false);
    const [pendingSync, setPendingSync] = useState(false);
    const [polishNotice, setPolishNotice] = useState<string | null>(null);
    const [draftConflict, setDraftConflict] = useState<DraftConflict | null>(null);
    const [entryLocation, setEntryLocation] = useState<EntryLocation | null>(null);
    const [deviceSnapshot, setDeviceSnapshot] = useState<DeviceSnapshot | null>(null);
    const [audioLevel, setAudioLevel] = useState(0);
    const [recordingElapsed, setRecordingElapsed] = useState(0);
    const [isBackgroundRefining, setIsBackgroundRefining] = useState(false);
    const [mirrorSentence, setMirrorSentence] = useState<string | null>(null);
    const [showFirstEntryHandoff, setShowFirstEntryHandoff] = useState(entrySource === 'onboarding');

    const fileInputRef = useRef<HTMLInputElement>(null);
    const mirrorTimerRef = useRef<NodeJS.Timeout>();
    const autoSaveTimeoutRef = useRef<NodeJS.Timeout>();
    const draftPersistTimeoutRef = useRef<NodeJS.Timeout>();
    const polishNoticeTimeoutRef = useRef<NodeJS.Timeout>();
    const draftInitRef = useRef(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const browserTranscriptRef = useRef('');
    const shouldProcessVoiceStopRef = useRef(false);
    const voiceRecordingStartedAtRef = useRef<number | null>(null);
    const captureMonitorRef = useRef<Awaited<ReturnType<typeof createVoiceCaptureMonitor>> | null>(null);
    const pendingVoicePreviewRef = useRef<string>('');
    const appliedVoiceJobIdsRef = useRef<Set<string>>(new Set());
    const completionTrackedVoiceJobIdsRef = useRef<Set<string>>(new Set());

    const {
        extractedData,
        setExtractedData,
        isAnalyzing,
        aiInsights,
        setAiInsights,
        isAiLoading,
        aiError,
        buildAnalysisPayload,
        handleDeepInsight,
        aiEmotionEntries,
        aiEmotionMax,
    } = useEntryAnalysis({
        content,
        contentHtml,
        entryId,
        apiFetch,
        saveDraft,
        titleOverride,
        moodOverride,
        tagsOverride,
        audioUrl,
        category,
        lifeArea,
        chapterId: collectionId,
        pendingSync,
    });
    const duplicateCheckTitle = titleOverride || extractedData?.title || '';

    useEffect(() => {
        contentRef.current = content;
    }, [content]);

    const canRecordVoiceAudio = typeof window !== 'undefined'
        && !!navigator.mediaDevices?.getUserMedia
        && typeof MediaRecorder !== 'undefined';

    const {
        isSupported: isVoicePreviewSupported,
        isListening: isBrowserListening,
        interimText,
        error: speechError,
        start: startSpeechPreview,
        stop: stopSpeechPreview,
    } = useSpeechRecognition({
        language: getSpeechPreviewLocale(DEFAULT_VOICE_LANGUAGE_MODE),
        interimResults: true,
        continuous: true,
        autoRestart: true,
        onFinal: (text: string) => {
            if (!text.trim()) return;
            browserTranscriptRef.current = appendVoiceText(browserTranscriptRef.current, text);
            // Live insert finalized phrases into the editor as user speaks
            setContent((current) => appendVoiceText(current, text));
        },
    });

    const isVoiceSupported = canRecordVoiceAudio || isVoicePreviewSupported;
    const isRecording = Boolean(isBrowserListening || (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive'));

    useEffect(() => {
        if (speechError && !canRecordVoiceAudio) setVoiceError(speechError);
    }, [canRecordVoiceAudio, speechError]);

    useEffect(() => {
        if (!isVoiceSupported) {
            setVoiceError('Voice notes are not available in this browser.');
        }
    }, [isVoiceSupported]);

    const stopVoiceMediaStream = useCallback(() => {
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach((track) => track.stop());
            mediaStreamRef.current = null;
        }
    }, []);

    const cleanupVoiceCapture = useCallback(() => {
        captureMonitorRef.current?.dispose();
        captureMonitorRef.current = null;
        stopVoiceMediaStream();
        mediaRecorderRef.current = null;
        audioChunksRef.current = [];
        voiceRecordingStartedAtRef.current = null;
    }, [stopVoiceMediaStream]);

    // Silently capture location when entry page loads (if permission already granted)
    useEffect(() => {
        let cancelled = false;
        captureEntryLocation()
            .then((loc) => { if (!cancelled && loc) setEntryLocation(loc); })
            .catch(() => {});
        captureDeviceSnapshot()
            .then((snap) => { if (!cancelled) setDeviceSnapshot(snap); })
            .catch(() => {});
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        return () => {
            shouldProcessVoiceStopRef.current = false;
            cleanupVoiceCapture();
            if (mirrorTimerRef.current) {
                clearTimeout(mirrorTimerRef.current);
            }
        };
    }, [cleanupVoiceCapture]);

    // Navigation guard: warn before leaving during active recording
    useEffect(() => {
        if (!isRecording) return;
        const handler = (e: BeforeUnloadEvent) => {
            e.preventDefault();
        };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [isRecording]);

    useEffect(() => {
        if (typeof navigator !== 'undefined' && navigator.onLine) {
            processQueue();
        }
    }, [processQueue]);

    useEffect(() => {
        if (modeParam === 'full') {
            setShowAdvancedTools(true);
        }
    }, [modeParam]);

    useEffect(() => {
        if (!user) return;
        const controller = new AbortController();
        let mounted = true;

        const fetchCollections = async () => {
            try {
                const response = await apiFetch(`${API_URL}/chapters`, { signal: controller.signal });
                if (!response.ok) return;
                const data = await response.json();
                if (!mounted) return;
                const options = Array.isArray(data?.chapters)
                    ? data.chapters
                        .map((chapter: any) => ({
                            id: String(chapter.id),
                            name: String(chapter.name || 'Untitled'),
                        }))
                        .filter((item: CollectionOption) => !!item.id)
                    : [];
                setCollections(options);
            } catch (error) {
                if (controller.signal.aborted) return;
                console.error('Failed to load collections', error);
            }
        };

        fetchCollections();
        return () => {
            mounted = false;
            controller.abort();
        };
    }, [user, apiFetch]);

    useEffect(() => {
        const detailsEnabled = showAdvancedTools && !isWhisperMode;

        if (!user || !detailsEnabled) {
            setDuplicateCandidates([]);
            setDuplicateError('');
            setIsCheckingDuplicates(false);
            return;
        }

        const normalizedContent = content.trim();
        const offline = typeof navigator !== 'undefined' && !navigator.onLine;
        if (offline || normalizedContent.length < 60) {
            setDuplicateCandidates([]);
            setDuplicateError('');
            setIsCheckingDuplicates(false);
            return;
        }

        const controller = new AbortController();
        const timeout = setTimeout(async () => {
            setIsCheckingDuplicates(true);
            setDuplicateError('');

            try {
                const response = await apiFetch(`${API_URL}/entries/duplicate-check`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        content: normalizedContent,
                        title: duplicateCheckTitle || null,
                        entryId,
                    }),
                    signal: controller.signal,
                });

                const data = await response.json().catch(() => null);
                if (!response.ok) {
                    throw new Error(data?.message || 'We could not compare this note to older ones right now.');
                }

                setDuplicateCandidates(Array.isArray(data?.duplicates) ? data.duplicates : []);
            } catch (error: any) {
                if (controller.signal.aborted) return;
                console.error('Duplicate detection failed:', error);
                setDuplicateCandidates([]);
                setDuplicateError(error?.message || 'We could not compare this note to older ones right now.');
            } finally {
                if (!controller.signal.aborted) {
                    setIsCheckingDuplicates(false);
                }
            }
        }, 1100);

        return () => {
            controller.abort();
            clearTimeout(timeout);
        };
    }, [apiFetch, content, duplicateCheckTitle, entryId, isWhisperMode, showAdvancedTools, user]);

    useEffect(() => {
        return () => {
            if (polishNoticeTimeoutRef.current) {
                clearTimeout(polishNoticeTimeoutRef.current);
            }
        };
    }, []);

    const applyCompletedVoiceTranscript = useCallback((job: VoiceTranscriptionJob) => {
        if (appliedVoiceJobIdsRef.current.has(job.id) || !job.transcript) {
            return;
        }

        appliedVoiceJobIdsRef.current.add(job.id);
        const transcript: VoiceTranscriptionResponse = {
            ...job.transcript,
            captureMeta: job.captureMeta || job.transcript.captureMeta || null,
        };
        const nextText = transcript.cleanTranscript.trim();
        const previewText = pendingVoicePreviewRef.current.trim();

        if (nextText) {
            setContent((current) => {
                const normalizedCurrent = current.replace(/\s+/g, ' ').trim().toLowerCase();
                const normalizedPreview = previewText.replace(/\s+/g, ' ').trim().toLowerCase();
                const normalizedNext = nextText.replace(/\s+/g, ' ').trim().toLowerCase();

                if (!normalizedCurrent) return nextText;
                if (normalizedPreview && normalizedCurrent === normalizedPreview) return nextText;
                if (normalizedCurrent.includes(normalizedNext)) return current;
                return appendVoiceText(current, nextText);
            });
        }

        setVoiceCapture((current) => mergeVoiceCaptureState(current, transcript));

        if (job.audioUrl) {
            setAudioUrl(job.audioUrl);
        }

        if (transcript.source === 'backend_transcribe' && !transcript.reviewRequired) {
            setVoiceError(null);
        }

        if (!completionTrackedVoiceJobIdsRef.current.has(job.id)) {
            completionTrackedVoiceJobIdsRef.current.add(job.id);
            void trackEvent({
                eventType: 'voice_transcribe_succeeded',
                value: 'entry_new',
                metadata: {
                    source: transcript.source,
                    provider: transcript.providerMeta?.provider || null,
                    model: transcript.providerMeta?.model || null,
                    reviewRequired: transcript.reviewRequired,
                    jobStatus: job.status,
                },
            });
        }

        pendingVoicePreviewRef.current = '';
        setIsVoiceProcessing(false);
        setIsBackgroundRefining(false);
    }, [trackEvent]);

    useEffect(() => {
        if (!user || draftInitRef.current) return;
        draftInitRef.current = true;

        const stagedVoiceCapture = searchParams.get('voiceSession') ? takePendingVoiceCapture() : null;
        const stagedTranscript = stagedVoiceCapture?.transcript || null;
        const voiceText = searchParams.get('voice');
        const promptText = searchParams.get('prompt');
        const audioParam = stagedVoiceCapture?.audioUrl || searchParams.get('audioUrl');
        const seededVoiceCapture = stagedTranscript
            ? toVoiceCaptureState(stagedTranscript)
            : voiceText?.trim()
                ? toVoiceCaptureState(buildBrowserFallbackTranscription(voiceText, DEFAULT_VOICE_LANGUAGE_MODE))
                : null;
        const seededText = stagedTranscript?.cleanTranscript || voiceText || '';
        const savedDraft = loadDraft();
        const restoredVoiceCapture = parseStoredVoiceCapture(savedDraft?.analysis?.voice);
        const restoredVoiceJob = parseStoredVoiceJob(savedDraft?.analysis?.voice, savedDraft?.audioUrl || audioParam || null);
        const pendingVoiceJob = stagedVoiceCapture?.pendingJob
            || (stagedVoiceCapture?.jobId && stagedVoiceCapture.audioUrl
                ? {
                    id: stagedVoiceCapture.jobId,
                    entryId: null,
                    audioUrl: stagedVoiceCapture.audioUrl,
                    fileName: null,
                    mimeType: 'audio/webm',
                    languageMode: stagedVoiceCapture.languageMode || DEFAULT_VOICE_LANGUAGE_MODE,
                    candidateLanguages: [],
                    recordingDurationMs: null,
                    hintText: null,
                    entryContext: null,
                    status: 'PENDING' as const,
                    provider: null,
                    model: null,
                    detectedLanguage: null,
                    attemptCount: 0,
                    maxAttempts: 4,
                    lastError: null,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    startedAt: null,
                    completedAt: null,
                    canceledAt: null,
                    captureMeta: stagedVoiceCapture.captureMeta || null,
                    transcript: null,
                }
                : null);

        pendingVoicePreviewRef.current = stagedVoiceCapture?.previewText?.trim() || '';

        if (seededText) {
            if (savedDraft?.content?.trim()) {
                setContent(savedDraft.content);
                setContentHtml(savedDraft.contentHtml || '');
                setTitleOverride(savedDraft.title || '');
                setMoodOverride(savedDraft.mood || null);
                setTagsOverride(savedDraft.tags || []);
                setAudioUrl(savedDraft.audioUrl || null);
                const draftCategory = normalizeCategory(savedDraft.category);
                setCategory(draftCategory);
                setLifeArea(normalizeLifeArea(savedDraft.lifeArea, draftCategory));
                setCollectionId(savedDraft.chapterId || null);
                if (savedDraft.analysis?.deterministic) {
                    setExtractedData(savedDraft.analysis.deterministic as StructuredEntryData);
                }
                if (savedDraft.analysis?.ai) {
                    setAiInsights(savedDraft.analysis.ai);
                }
                setVoiceCapture(restoredVoiceCapture);
                setVoiceJob(pendingVoiceJob || restoredVoiceJob);
                setDraftRestored(true);
                setPendingSync(savedDraft.pendingSync);
                setDraftConflict({
                    seededText,
                    seededAudioUrl: audioParam || null,
                    seededTags: gentleReflectionTags,
                    seededVoiceCapture,
                });
                return;
            }

            setContent(seededText);
            if (promptText && !seededText) {
                setPromptHint(promptText);
            }
            setTagsOverride(gentleReflectionTags);
            setVoiceCapture(seededVoiceCapture);
            setVoiceJob(pendingVoiceJob || restoredVoiceJob);
            if (audioParam) {
                setAudioUrl(audioParam);
            }
            clearDraft();
            return;
        }

        if (savedDraft?.content) {
            setContent(savedDraft.content);
            setContentHtml(savedDraft.contentHtml || '');
            setTitleOverride(savedDraft.title || '');
            setMoodOverride(savedDraft.mood || null);
            setTagsOverride(savedDraft.tags || []);
            setAudioUrl(savedDraft.audioUrl || null);
            const draftCategory = normalizeCategory(savedDraft.category);
            setCategory(draftCategory);
            setLifeArea(normalizeLifeArea(savedDraft.lifeArea, draftCategory));
            setCollectionId(savedDraft.chapterId || null);
            if (savedDraft.analysis?.deterministic) {
                setExtractedData(savedDraft.analysis.deterministic as StructuredEntryData);
            }
            if (savedDraft.analysis?.ai) {
                setAiInsights(savedDraft.analysis.ai);
            }
            setVoiceCapture(restoredVoiceCapture);
            setVoiceJob(restoredVoiceJob || pendingVoiceJob);
            setDraftRestored(true);
            setPendingSync(savedDraft.pendingSync);
            if (audioParam) {
                setAudioUrl(audioParam);
            }
            return;
        }

        if (pendingVoiceJob) {
            setVoiceJob(pendingVoiceJob);
            if (audioParam) {
                setAudioUrl(audioParam);
            }
        }
    }, [user, searchParams, loadDraft, clearDraft, gentleReflectionTags, setExtractedData, setAiInsights]);

    useEffect(() => {
        if (!voiceJob) {
            return;
        }

        if (voiceJob.status === 'COMPLETED') {
            applyCompletedVoiceTranscript(voiceJob);
            return;
        }

        if (voiceJob.status === 'FAILED' || voiceJob.status === 'CANCELED') {
            setIsVoiceProcessing(false);
            setIsBackgroundRefining(false);

            if (VOICE_ALLOW_BROWSER_FALLBACK && pendingVoicePreviewRef.current.trim()) {
                const fallback = buildBrowserFallbackTranscription(
                    pendingVoicePreviewRef.current,
                    (voiceJob.languageMode as typeof DEFAULT_VOICE_LANGUAGE_MODE | string) as any
                );
                fallback.captureMeta = voiceJob.captureMeta || null;
                setVoiceCapture((current) => mergeVoiceCaptureState(current, fallback));
                setContent((current) => {
                    const previewText = pendingVoicePreviewRef.current.trim();
                    if (!previewText) return current;
                    const normalizedCurrent = current.replace(/\s+/g, ' ').trim().toLowerCase();
                    const normalizedPreview = previewText.replace(/\s+/g, ' ').trim().toLowerCase();
                    if (!normalizedCurrent || normalizedCurrent === normalizedPreview) {
                        return previewText;
                    }
                    return appendVoiceText(current, previewText);
                });
                setVoiceError('Transcript may need review before saving.');
                pendingVoicePreviewRef.current = '';
                return;
            }

            if (voiceJob.lastError) {
                setVoiceError(voiceJob.lastError);
            }
            return;
        }

        // Only block UI if we don't have live text already in the editor
        if (!isBackgroundRefining) {
            setIsVoiceProcessing(true);
        }
        let cancelled = false;
        let timer: ReturnType<typeof setTimeout> | null = null;

        const poll = async () => {
            try {
                const nextJob = await getVoiceTranscriptionJob(apiFetch, voiceJob.id);
                if (cancelled) return;

                setVoiceJob(nextJob);
                if (nextJob.audioUrl) {
                    setAudioUrl(nextJob.audioUrl);
                }

                if (nextJob.status === 'COMPLETED') {
                    applyCompletedVoiceTranscript(nextJob);
                    return;
                }

                if (nextJob.status === 'FAILED' || nextJob.status === 'CANCELED') {
                    setIsVoiceProcessing(false);
                    setIsBackgroundRefining(false);
                    if (nextJob.lastError) {
                        setVoiceError(nextJob.lastError);
                    }
                    return;
                }

                timer = setTimeout(poll, 1800);
            } catch (error) {
                if (cancelled) return;
                timer = setTimeout(poll, 3000);
            }
        };

        void poll();

        return () => {
            cancelled = true;
            if (timer) {
                clearTimeout(timer);
            }
        };
    }, [apiFetch, applyCompletedVoiceTranscript, voiceJob]);

    const handleKeepDraft = useCallback(() => {
        setDraftConflict(null);
    }, []);

    const handleReplaceDraftWithPrompt = useCallback(() => {
        if (!draftConflict) return;
        setContent(draftConflict.seededText);
        setContentHtml('');
        setTitleOverride('');
        setMoodOverride(null);
        setTagsOverride(draftConflict.seededTags);
        setAudioUrl(draftConflict.seededAudioUrl);
        setVoiceCapture(draftConflict.seededVoiceCapture);
        setCategory('PERSONAL');
        setLifeArea(DEFAULT_LIFE_AREA_BY_CATEGORY.PERSONAL);
        setCollectionId(null);
        setExtractedData(null);
        setAiInsights(null);
        setPendingSync(false);
        setDraftRestored(false);
        setEntryId(null);
        clearDraft();
        setDraftConflict(null);
    }, [draftConflict, clearDraft, setExtractedData, setAiInsights]);

    const handleEditorChange = useCallback((text: string, html: string) => {
        setContent(text);
        setContentHtml(html);
    }, []);

    const handlePolishWriting = useCallback(() => {
        if (!content.trim()) return;

        const polishedContent = polishEntryText(content);
        const polishedTitle = titleOverride ? polishTitle(titleOverride) : '';
        const contentChanged = polishedContent !== content;
        const titleChanged = !!titleOverride && polishedTitle !== titleOverride;

        if (contentChanged) {
            setContent(polishedContent);
        }
        if (titleChanged) {
            setTitleOverride(polishedTitle);
        }

        setPolishNotice(contentChanged || titleChanged
            ? 'Writing polished: grammar, spacing, and sentence flow improved.'
            : 'Your writing already looks clean.');
        if (polishNoticeTimeoutRef.current) clearTimeout(polishNoticeTimeoutRef.current);
        polishNoticeTimeoutRef.current = setTimeout(() => setPolishNotice(null), 3500);
    }, [content, titleOverride]);

    const buildPersistedAnalysis = useCallback(() => {
        const baseAnalysis = buildAnalysisPayload();
        const voiceAnalysis = (voiceCapture || voiceJob)
            ? {
                rawTranscript: voiceCapture?.rawTranscript || '',
                cleanTranscript: voiceCapture?.cleanTranscript || '',
                detectedLanguage: voiceCapture?.detectedLanguage || voiceJob?.detectedLanguage || null,
                providers: voiceCapture?.providers || [],
                models: voiceCapture?.models || [],
                sources: voiceCapture?.sources || [],
                reviewRequired: voiceCapture?.reviewRequired || false,
                confidenceOverall: voiceCapture?.confidenceOverall ?? null,
                clipCount: voiceCapture?.clipCount || 0,
                captureMeta: voiceCapture?.captureMeta || voiceJob?.captureMeta || null,
                transcriptionJobId: voiceJob?.id || null,
                transcriptionStatus: voiceJob?.status || null,
                transcriptionProvider: voiceJob?.provider || null,
                transcriptionModel: voiceJob?.model || null,
                transcriptionLanguageMode: voiceJob?.languageMode || DEFAULT_VOICE_LANGUAGE_MODE,
                transcriptionLastError: voiceJob?.lastError || null,
            }
            : null;

        if (!baseAnalysis && !voiceAnalysis) return undefined;

        return {
            ...(baseAnalysis || {}),
            ...(voiceAnalysis ? { voice: voiceAnalysis } : {}),
        };
    }, [buildAnalysisPayload, voiceCapture, voiceJob]);

    const persistDraftSnapshot = useCallback((pendingSyncOverride: boolean) => {
        saveDraft({
            content,
            contentHtml,
            title: titleOverride,
            mood: moodOverride,
            tags: tagsOverride,
            audioUrl,
            category,
            lifeArea,
            chapterId: collectionId,
            analysis: buildPersistedAnalysis(),
            updatedAt: Date.now(),
            pendingSync: pendingSyncOverride,
        });
    }, [
        audioUrl,
        buildPersistedAnalysis,
        category,
        collectionId,
        content,
        contentHtml,
        lifeArea,
        moodOverride,
        saveDraft,
        tagsOverride,
        titleOverride,
    ]);

    const processVoiceCapture = useCallback(async (
        audioBlob: Blob | null,
        captureMeta: VoiceCaptureQualityMetrics | null,
        recordedMimeType?: string | null,
        recordingDurationMs?: number | null
    ) => {
        const browserTranscript = browserTranscriptRef.current.trim();
        if (!audioBlob && !browserTranscript) {
            setVoiceError('No voice note came through. Try once more.');
            return;
        }

        // If we already have live text in the editor, use non-blocking background refinement
        const hasLiveText = contentRef.current.trim().length > 0 && browserTranscript.length > 0;
        if (hasLiveText) {
            setIsBackgroundRefining(true);
        } else {
            setIsVoiceProcessing(true);
        }
        setVoiceJob(null);
        pendingVoicePreviewRef.current = browserTranscript;
        let transcription: VoiceTranscriptionResponse | null = null;

        try {
            if (audioBlob && VOICE_BACKEND_TRANSCRIPTION_ENABLED) {
                void trackEvent({
                    eventType: 'voice_transcribe_requested',
                    value: 'entry_new',
                    metadata: {
                        languageMode: DEFAULT_VOICE_LANGUAGE_MODE,
                        captureRating: captureMeta?.rating || null,
                    },
                });

                const createdJob = await createVoiceTranscriptionJob(apiFetch, {
                    audioBlob,
                    entryId,
                    languageMode: DEFAULT_VOICE_LANGUAGE_MODE,
                    candidateLanguages: resolveCandidateLanguages(DEFAULT_VOICE_LANGUAGE_MODE),
                    previewText: browserTranscript || null,
                    recordingDurationMs: recordingDurationMs ?? null,
                    captureMeta,
                    filename: getVoiceRecordingFilename(recordedMimeType),
                });
                setVoiceJob(createdJob);
                if (createdJob.audioUrl) {
                    setAudioUrl(createdJob.audioUrl);
                }
                browserTranscriptRef.current = '';
                return;
            }
        } catch (error: any) {
            console.error('Entry voice transcription failed:', error);
            void trackEvent({
                eventType: 'voice_transcribe_failed',
                value: 'entry_new',
                metadata: {
                    code: error?.code || null,
                    retryable: Boolean(error?.retryable),
                },
            });
            setVoiceError(error?.message || 'Voice note could not be cleaned up. We will keep what we safely heard.');
        }

        if (!transcription && VOICE_ALLOW_BROWSER_FALLBACK && browserTranscript) {
            transcription = buildBrowserFallbackTranscription(browserTranscript, DEFAULT_VOICE_LANGUAGE_MODE);
            transcription.captureMeta = captureMeta;
            setVoiceError('Transcript may need review before saving.');
            void trackEvent({
                eventType: 'voice_fallback_used',
                value: 'entry_new',
                metadata: {
                    reason: VOICE_BACKEND_TRANSCRIPTION_ENABLED ? 'backend_failed' : 'backend_disabled',
                },
            });
        }

        if (!transcription) {
            setIsVoiceProcessing(false);
            browserTranscriptRef.current = '';
            return;
        }

        const nextText = transcription.cleanTranscript.trim();
        if (nextText) {
            setContent((current) => appendVoiceText(current, nextText));
        }
        transcription.captureMeta = captureMeta;
        setVoiceCapture((current) => mergeVoiceCaptureState(current, transcription));

        if (transcription.source === 'backend_transcribe' && !transcription.reviewRequired) {
            setVoiceError(null);
        }

        setIsVoiceProcessing(false);
        browserTranscriptRef.current = '';
        setVoiceJob(null);
    }, [apiFetch, entryId, trackEvent]);

    const startRecording = useCallback(async () => {
        if (isVoiceProcessing) return;

        if (!isVoiceSupported) {
            setVoiceError('Voice capture is not supported in this browser.');
            return;
        }

        hapticSuccess(); // recording start

        setVoiceError(null);
        setVoiceJob(null);
        browserTranscriptRef.current = '';
        audioChunksRef.current = [];
        shouldProcessVoiceStopRef.current = true;
        voiceRecordingStartedAtRef.current = Date.now();

        try {
            if (canRecordVoiceAudio) {
                const stream = await requestVoiceRecordingStream();
                mediaStreamRef.current = stream;
                captureMonitorRef.current = await createVoiceCaptureMonitor(stream, {
                    onLevel: (level: number) => setAudioLevel(level),
                });

                const mediaRecorder = createVoiceMediaRecorder(stream);
                mediaRecorder.ondataavailable = (event) => {
                    if (event.data.size > 0) {
                        audioChunksRef.current.push(event.data);
                    }
                };
                mediaRecorder.onstop = async () => {
                    const shouldProcess = shouldProcessVoiceStopRef.current;
                    const chunks = [...audioChunksRef.current];
                    const recordingDurationMs = voiceRecordingStartedAtRef.current
                        ? Date.now() - voiceRecordingStartedAtRef.current
                        : null;
                    const captureMeta = captureMonitorRef.current ? await captureMonitorRef.current.stop() : null;
                    captureMonitorRef.current = null;
                    cleanupVoiceCapture();

                    if (!shouldProcess) {
                        return;
                    }

                    const recordedMimeType = normalizeRecordedAudioMimeType(
                        mediaRecorder.mimeType || chunks[0]?.type || 'audio/webm'
                    );
                    const audioBlob = chunks.length > 0
                        ? new Blob(chunks, { type: recordedMimeType })
                        : null;
                    await processVoiceCapture(audioBlob, captureMeta, recordedMimeType, recordingDurationMs);
                };
                mediaRecorder.start();
                mediaRecorderRef.current = mediaRecorder;
            }

            if (isVoicePreviewSupported) {
                startSpeechPreview();
            }

            void trackEvent({
                eventType: 'voice_recording_started',
                value: 'entry_new',
                metadata: {
                    hasAudioRecorder: canRecordVoiceAudio,
                    hasBrowserPreview: isVoicePreviewSupported,
                },
            });
        } catch (error) {
            console.error('Failed to start entry voice capture:', error);
            setVoiceError(getVoiceStartErrorMessage(error));
            cleanupVoiceCapture();
        }
    }, [
        canRecordVoiceAudio,
        cleanupVoiceCapture,
        isVoiceProcessing,
        isVoicePreviewSupported,
        isVoiceSupported,
        processVoiceCapture,
        startSpeechPreview,
        trackEvent,
    ]);

    const stopRecording = useCallback(() => {
        hapticTap(); // recording stop
        shouldProcessVoiceStopRef.current = true;
        stopSpeechPreview();
        const recordingDurationMs = voiceRecordingStartedAtRef.current
            ? Date.now() - voiceRecordingStartedAtRef.current
            : null;

        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
            return;
        }

        cleanupVoiceCapture();
        void processVoiceCapture(null, null, null, recordingDurationMs);
    }, [cleanupVoiceCapture, processVoiceCapture, stopSpeechPreview]);

    // Auto-start recording when navigated with autoRecord=1 (e.g. from dashboard voice button)
    const autoRecordTriggeredRef = useRef(false);
    useEffect(() => {
        if (autoRecordTriggeredRef.current) return;
        if (!draftInitRef.current) return;
        if (searchParams.get('autoRecord') !== '1') return;
        if (!isVoiceSupported || isVoiceProcessing || isRecording) return;

        autoRecordTriggeredRef.current = true;
        // Small delay to let the page settle visually before starting mic
        const timer = setTimeout(() => {
            startRecording();
        }, 150);
        return () => clearTimeout(timer);
    }, [searchParams, isVoiceSupported, isVoiceProcessing, isRecording, startRecording]);

    // Elapsed recording timer
    useEffect(() => {
        if (!isRecording) {
            setRecordingElapsed(0);
            setAudioLevel(0);
            return;
        }
        setRecordingElapsed(0);
        const interval = setInterval(() => {
            setRecordingElapsed((prev) => prev + 1);
        }, 1000);
        return () => clearInterval(interval);
    }, [isRecording]);

    const handleOpenFullStudio = useCallback(() => {
        setShowAdvancedTools(true);
        void trackEvent({
            eventType: 'entry_more_details_opened',
            value: isQuickMode ? 'from_quick_note' : 'from_note_page',
            metadata: {
                hasDraftContent: Boolean(content.trim() || titleOverride.trim() || tagsOverride.length > 0 || audioUrl),
            },
        });
    }, [audioUrl, content, isQuickMode, tagsOverride.length, titleOverride, trackEvent]);

    const handleFinishLater = useCallback(() => {
        const hasDraftableContent = Boolean(
            content.trim() ||
            titleOverride.trim() ||
            audioUrl ||
            tagsOverride.length > 0
        );

        if (hasDraftableContent) {
            const offline = typeof navigator !== 'undefined' && !navigator.onLine;
            persistDraftSnapshot(pendingSync || offline);
        }

        void trackEvent({
            eventType: 'entry_finish_later',
            value: isQuickMode ? 'quick' : 'full',
            metadata: {
                hasDraftableContent,
            },
        });
        navigateBack();
    }, [audioUrl, content, isQuickMode, navigateBack, pendingSync, persistDraftSnapshot, tagsOverride.length, titleOverride, trackEvent]);

    const handleSave = useCallback(async (isAutoSave = false) => {
        if (!content.trim()) {
            if (!isAutoSave) setError('Write or say one line before saving.');
            return;
        }

        const saveWordCount = content.trim().split(/\s+/).length;
        if (saveWordCount < 130) {
            persistDraftSnapshot(true);
            if (!isAutoSave) {
                hapticWarning();
                toast.info(
                    'I still need to know more about this',
                    `Add a bit more detail so I can give you meaningful insights (${saveWordCount}/130 words).`,
                );
            }
            return;
        }

        const offline = typeof navigator !== 'undefined' && !navigator.onLine;
        if (offline) {
            persistDraftSnapshot(true);
            setPendingSync(true);
            if (!isAutoSave) setError('You are offline. This draft is safe here and will sync when you are back online.');
            return;
        }

        setIsSaving(true);
        if (!isAutoSave) setError('');

        const finalTitle = titleOverride || extractedData?.title || null;
        const finalMood = moodOverride || extractedData?.primaryEmotion?.emotion || null;
        const baseTags = tagsOverride.length > 0 ? tagsOverride : (extractedData?.suggestedTags || []);
        const finalTags = mergeUniqueTags(baseTags, isGentleReflectionEntry ? gentleReflectionTags : []);
        const analysis = buildPersistedAnalysis();

        try {
            const method = entryId ? 'PUT' : 'POST';
            const url = entryId ? `${API_URL}/entries/${entryId}` : `${API_URL}/entries`;

            const response = await apiFetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: finalTitle,
                    content,
                    contentHtml,
                    mood: finalMood,
                    category,
                    lifeArea,
                    chapterId: collectionId,
                    tags: finalTags,
                    audioUrl,
                    analysis,
                    ...(entryLocation ? {
                        locationLat: entryLocation.lat,
                        locationLng: entryLocation.lng,
                        locationName: entryLocation.name,
                    } : {}),
                    ...(deviceSnapshot ? { deviceContext: deviceSnapshot } : {}),
                }),
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || 'Could not save your note. Try again in a moment.');
            }

            const savedEntryId = data.entry?.id || entryId || null;

            if (!entryId && data.entry?.id) setEntryId(data.entry.id);

            if (voiceJob?.id && savedEntryId && voiceJob.entryId !== savedEntryId) {
                try {
                    const attachedJob = await attachVoiceTranscriptionJob(apiFetch, voiceJob.id, savedEntryId);
                    setVoiceJob(attachedJob);
                    if (attachedJob.status === 'COMPLETED') {
                        applyCompletedVoiceTranscript(attachedJob);
                    }
                } catch (attachError) {
                    console.warn('Failed to attach voice transcription job to entry', attachError);
                }
            }

            setLastSaved(new Date());
            setPendingSync(false);

            if (!isAutoSave) {
                void trackEvent({
                    eventType: 'entry_saved',
                    value: isQuickMode ? 'quick' : 'full',
                    metadata: {
                        entryId: savedEntryId,
                        wordCount: content.trim().split(/\s+/).length,
                        hasMood: Boolean(finalMood),
                        hasTags: finalTags.length > 0,
                        source: entrySource || null,
                    },
                });
                if (voiceCapture) {
                    const normalizedContent = content.replace(/\s+/g, ' ').trim().toLowerCase();
                    const normalizedCleanTranscript = voiceCapture.cleanTranscript.replace(/\s+/g, ' ').trim().toLowerCase();

                    void trackEvent({
                        eventType: 'voice_entry_saved',
                        value: isQuickMode ? 'quick' : 'full',
                        metadata: {
                            entryId: savedEntryId,
                            clipCount: voiceCapture.clipCount,
                            reviewRequired: voiceCapture.reviewRequired,
                            provider: voiceCapture.providers[0] || null,
                            source: voiceCapture.sources[0] || null,
                        },
                    });

                    if (
                        normalizedCleanTranscript
                        && normalizedContent
                        && !normalizedContent.includes(normalizedCleanTranscript)
                    ) {
                        void trackEvent({
                            eventType: 'voice_transcript_corrected',
                            value: isQuickMode ? 'quick' : 'full',
                            metadata: {
                                entryId: savedEntryId,
                                clipCount: voiceCapture.clipCount,
                            },
                        });
                    }
                }
                localStorage.setItem('lastEntryTime', Date.now().toString());
                if (!entryId) {
                    awardXP(50, 'Entry created');
                    refreshStats();
                    hapticSuccess();
                }
                clearDraft();
                // After the user's first-ever save, prompt for push permission with context.
                // Guard: only once per session, and only if permission state is resolved.
                if (!entryId && !pushPermissionGranted && !pushLoading && !pushAskedRef.current) {
                    pushAskedRef.current = true;
                    void requestPushPermission();
                }
                if (!entryId && isGentleReflectionEntry && data.entry?.id) {
                    if (user?.id && gentleReflectionId) {
                        markGentleReflectionCompleted(user.id, gentleReflectionId);
                    }

                    toast.success('Note saved');
                    router.push(appendReturnTo(`/entry/view?id=${data.entry.id}`, backHref));
                    return;
                }

                toast.success('Note saved');

                // ── Mirror: show a brief reflection before navigating ──
                const sentence = extractedData?.growthPoints && extractedData.growthPoints.length > 0
                    ? 'This entry had more growth language than your average.'
                    : extractedData?.overallSentiment === 'mixed'
                        ? "There's a small gap between your stated mood and your writing — that's worth sitting with."
                        : extractedData?.keyPhrases && extractedData.keyPhrases.length >= 3
                            ? `You keep circling "${extractedData.keyPhrases[0]}" — that thread might mean something.`
                            : null;

                if (sentence && !entryId) {
                    setMirrorSentence(sentence);
                    mirrorTimerRef.current = setTimeout(() => {
                        setMirrorSentence(null);
                        router.push(backHref);
                    }, 5000);
                } else {
                    router.push(backHref);
                }
            } else {
                persistDraftSnapshot(false);
            }
        } catch (err: any) {
            console.error('Save error:', err);
            if (!isAutoSave) {
                const msg = err.message || 'Could not save your note. Try again in a moment.';
                setError(msg);
                toast.error(msg);
                hapticError();
            }
        } finally {
            setIsSaving(false);
        }
    }, [
        content,
        contentHtml,
        titleOverride,
        moodOverride,
        tagsOverride,
        audioUrl,
        category,
        lifeArea,
        collectionId,
        extractedData,
        buildPersistedAnalysis,
        entryId,
        apiFetch,
        applyCompletedVoiceTranscript,
        awardXP,
        refreshStats,
        clearDraft,
        backHref,
        router,
        persistDraftSnapshot,
        gentleReflectionId,
        gentleReflectionTags,
        entrySource,
        isGentleReflectionEntry,
        isQuickMode,
        trackEvent,
        user?.id,
        voiceCapture,
        toast,
        pushPermissionGranted,
        pushLoading,
        requestPushPermission,
    ]);

    useEffect(() => {
        if (!content.trim() || isSaving) return;

        if (draftPersistTimeoutRef.current) {
            clearTimeout(draftPersistTimeoutRef.current);
        }
        if (autoSaveTimeoutRef.current) {
            clearTimeout(autoSaveTimeoutRef.current);
        }

        draftPersistTimeoutRef.current = setTimeout(() => {
            const offline = typeof navigator !== 'undefined' && !navigator.onLine;
            persistDraftSnapshot(pendingSync || offline);
            if (offline) {
                setPendingSync(true);
            }
        }, 2000);

        autoSaveTimeoutRef.current = setTimeout(() => {
            const offline = typeof navigator !== 'undefined' && !navigator.onLine;
            if (offline) {
                setPendingSync(true);
                return;
            }
            handleSave(true);
        }, 10000);

        return () => {
            if (draftPersistTimeoutRef.current) {
                clearTimeout(draftPersistTimeoutRef.current);
            }
            if (autoSaveTimeoutRef.current) {
                clearTimeout(autoSaveTimeoutRef.current);
            }
        };
    }, [content, isSaving, pendingSync, persistDraftSnapshot, handleSave]);

    useEffect(() => {
        const onOnline = () => {
            if (pendingSync && content.trim()) {
                handleSave(true);
            }
            processQueue();
        };

        window.addEventListener('online', onOnline);
        return () => window.removeEventListener('online', onOnline);
    }, [pendingSync, content, handleSave, processQueue]);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
                event.preventDefault();
                if (!isSaving && content.trim()) {
                    void handleSave(false);
                }
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [content, isSaving, handleSave]);

    const addTag = useCallback((tag: string) => {
        const normalized = normalizeTag(tag);
        if (normalized && isValidTag(normalized) && !tagsOverride.some(t => normalizeTag(t) === normalized)) {
            setTagsOverride(prev => [...prev, normalized]);
        }
    }, [tagsOverride]);

    const removeTag = useCallback((tag: string) => {
        setTagsOverride(prev => prev.filter(t => t !== tag));
    }, []);

    const insertUploadedImage = useCallback((url: string, id: string) => {
        setContent(prev => `${prev}\n![Image](${url})\n`);
        clearUploadResult(id);
    }, [clearUploadResult]);

    const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const sourceFile = e.target.files?.[0];
        if (!sourceFile) return;
        if (fileInputRef.current) fileInputRef.current.value = '';

        setError('');
        let preparedFile: File | null = null;
        setIsUploading(true);
        try {
            const prepared = await prepareImageForUpload(sourceFile, 'entry');
            const file = prepared.file;
            preparedFile = file;
            const offline = typeof navigator !== 'undefined' && !navigator.onLine;

            if (offline) {
                await enqueueUpload({
                    endpoint: `${API_URL}/files/upload`,
                    fieldName: 'file',
                    file,
                    fileName: file.name,
                    fileType: file.type,
                });
                setError('You are offline. The image is queued and will upload when you are back online.');
                return;
            }

            const formData = new FormData();
            formData.append('file', file, file.name);

            const response = await apiFetch(`${API_URL}/files/upload`, {
                method: 'POST',
                body: formData,
            });
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'That image did not upload. Try again in a moment.');
            }

            setContent(prev => `${prev}\n![Image](${data.url})\n`);
        } catch (err: any) {
            if (preparedFile && typeof navigator !== 'undefined' && !navigator.onLine) {
                await enqueueUpload({
                    endpoint: `${API_URL}/files/upload`,
                    fieldName: 'file',
                    file: preparedFile,
                    fileName: preparedFile.name,
                    fileType: preparedFile.type,
                });
                setError('That image is queued and will upload when you are back online.');
            } else {
                setError(err.message || 'That image did not upload. Try again in a moment.');
            }
        } finally {
            setIsUploading(false);
        }
    }, [apiFetch, enqueueUpload]);

    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Spinner size="md" />
            </div>
        );
    }

    if (!isAuthenticated) return null;

    const displayTitle = titleOverride || extractedData?.title || '';
    const displayMood = moodOverride || extractedData?.primaryEmotion?.emotion || null;
    const displayTags = tagsOverride.length > 0 ? tagsOverride : (extractedData?.suggestedTags || []);
    const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
    const readingTimeMinutes = Math.max(1, Math.ceil(wordCount / 200));
    const availableLifeAreas = LIFE_AREA_OPTIONS.filter((item) => item.category === category);
    const starterPrompt = getStarterPrompt(new Date(), displayMood);
    const writingSuggestions = getWritingSuggestions(content);
    const showStudioPanels = !isWhisperMode && showAdvancedTools;
    const voiceStatusMessage = voiceJob
        ? voiceJob.status === 'PENDING'
            ? 'Uploading your voice note...'
            : voiceJob.status === 'PROCESSING'
                ? 'Cleaning up the transcript...'
                : voiceJob.status === 'FAILED'
                    ? voiceJob.lastError || 'Voice note could not be cleaned up.'
                    : voiceJob.status === 'CANCELED'
                        ? 'Voice note was canceled.'
                        : voiceCapture?.captureMeta?.rating === 'poor'
                            ? 'The audio was rough, so give the transcript a quick look before saving.'
                            : null
        : null;
    const editorPlaceholder = content.trim()
        ? 'Keep going...'
        : promptHint
            ? promptHint
            : isWhisperMode
                ? 'What\u2019s on your mind tonight?'
                : `Try this: ${starterPrompt.text}`;

    const handleCategorySelect = (nextCategory: EntryCategory) => {
        setCategory(nextCategory);
        setLifeArea((current) => normalizeLifeArea(current, nextCategory));
    };

    const handleUseStarterPrompt = () => {
        if (content.trim()) return;
        setContent(`${starterPrompt.text}\n\n`);
    };

    return (
        <div className={`entry-studio min-h-screen selection:bg-primary/30 ${isWhisperMode ? 'bg-[rgb(var(--bg-canvas))] text-[rgb(var(--text-soft))]' : 'text-[rgb(var(--text-primary))]'}`}>
            {showFirstEntryHandoff && (
                <FirstEntryHandoff onDismiss={() => setShowFirstEntryHandoff(false)} />
            )}
            <h1 className="sr-only">New Entry</h1>
            {!isWhisperMode && (
                <>
                    <div className="fixed top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[150px] pointer-events-none" />
                    <div className="fixed bottom-0 right-1/4 w-64 h-64 bg-secondary/10 rounded-full blur-[120px] pointer-events-none" />
                </>
            )}

            <div className={`max-w-3xl mx-auto px-3 sm:px-4 pb-20 md:pb-8 relative z-10 ${isWhisperMode ? 'pt-12 md:pt-16' : 'pt-4 md:pt-8'}`}>
                {isWhisperMode && (
                    <p className="mb-8 text-center font-serif text-xs uppercase tracking-[0.2em] text-[rgba(255,255,255,0.24)]">whisper mode</p>
                )}
                <EntryTopBar
                    onBack={navigateBack}
                    backLabel={backLabel}
                    isSaving={isSaving}
                    lastSaved={lastSaved}
                    canSave={!isSaving && !!content.trim()}
                    onSave={() => handleSave(false)}
                    error={error}
                    draftRestored={draftRestored}
                    pendingSync={pendingSync}
                    wordCount={wordCount}
                    readingTimeMinutes={readingTimeMinutes}
                    showAdvancedTools={showAdvancedTools}
                    onToggleAdvancedTools={() => setShowAdvancedTools((prev) => !prev)}
                    polishNotice={polishNotice}
                    isQuickMode={isQuickMode}
                    isWhisperMode={isWhisperMode}
                    isBackgroundRefining={isBackgroundRefining}
                    onFinishLater={handleFinishLater}
                    onOpenFullStudio={handleOpenFullStudio}
                />

                <EntryEditorCard
                    isRecording={isRecording}
                    isVoiceProcessing={isVoiceProcessing}
                    isVoiceSupported={isVoiceSupported}
                    voiceError={voiceError}
                    voiceReviewRequired={voiceCapture?.reviewRequired}
                    voiceStatusMessage={voiceStatusMessage}
                    interimText={interimText}
                    onStartRecording={startRecording}
                    onStopRecording={stopRecording}
                    fileInputRef={fileInputRef}
                    onImageUpload={handleImageUpload}
                    isUploading={isUploading}
                    queueCount={queueCount}
                    recentUploads={recentUploads}
                    onInsertUploadedImage={insertUploadedImage}
                    onDismissUploaded={clearUploadResult}
                    audioUrl={audioUrl}
                    content={content}
                    editorPlaceholder={editorPlaceholder}
                    onEditorChange={handleEditorChange}
                    autoFocus={isQuickMode || isWhisperMode}
                    minimalEditor={isWhisperMode || (isQuickMode && !showAdvancedTools)}
                    showImageUpload={!isWhisperMode}
                    showFormattingToolbar={showAdvancedTools}
                />

                {!isWhisperMode && (
                    <section className="workspace-panel mb-6 rounded-2xl p-4">
                        <button
                            type="button"
                            onClick={() => setShowAdvancedTools((prev) => !prev)}
                            className="w-full flex items-center justify-between gap-3 text-left"
                        >
                            <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">
                                {showAdvancedTools ? 'Hide details' : 'More details'}
                            </p>
                            <span className="text-xs text-ink-muted">{showAdvancedTools ? '−' : '+'}</span>
                        </button>

                        <div className={`transition-all duration-300 ease-in-out ${showAdvancedTools ? 'max-h-[2400px] opacity-100 mt-4' : 'max-h-0 opacity-0 overflow-hidden'}`}>
                            <div className="space-y-4 border-t border-[rgba(var(--paper-border),0.92)] pt-4">
                                <EntryInsightsPanel
                                    embedded
                                    isAnalyzing={isAnalyzing}
                                    extractedData={extractedData}
                                    displayMood={displayMood}
                                    moods={MOODS}
                                    content={content}
                                    isAiLoading={isAiLoading}
                                    onDeepInsight={handleDeepInsight}
                                    aiError={aiError}
                                    aiInsights={aiInsights}
                                    aiEmotionEntries={aiEmotionEntries}
                                    aiEmotionMax={aiEmotionMax}
                                    displayTitle={displayTitle}
                                    setTitleOverride={setTitleOverride}
                                    moodOverride={moodOverride}
                                    setMoodOverride={setMoodOverride}
                                    displayTags={displayTags}
                                    removeTag={removeTag}
                                    addTag={addTag}
                                    duplicateCandidates={duplicateCandidates}
                                    isCheckingDuplicates={isCheckingDuplicates}
                                    duplicateError={duplicateError}
                                />

                                <div className="workspace-soft-panel rounded-2xl p-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Enhance writing</p>
                                        <button
                                            type="button"
                                            onClick={handlePolishWriting}
                                            disabled={!content.trim()}
                                            className="workspace-button-outline rounded-xl px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            Polish Writing
                                        </button>
                                    </div>
                                </div>

                                {content.trim().length > 0 && writingSuggestions.length > 0 && (
                                    <div className="workspace-panel rounded-2xl p-4">
                                        <div className="mb-2 flex items-center justify-between gap-2">
                                            <div className="text-xs uppercase tracking-[0.12em] text-ink-muted">Writing signals</div>
                                            <span className="workspace-pill-muted rounded-full px-2 py-0.5 text-xs uppercase tracking-[0.08em] text-ink-secondary">
                                                {writingSuggestions.length}
                                            </span>
                                        </div>
                                        <div className="space-y-2">
                                            {writingSuggestions.map((item) => (
                                                <div
                                                    key={item.id}
                                                    className="workspace-soft-panel rounded-xl px-3 py-2 text-sm text-ink-secondary"
                                                >
                                                    <span className="mr-1" aria-hidden="true">
                                                        {item.severity === 'warning'
                                                            ? <FiAlertTriangle className="inline" size={14} />
                                                            : <FiZap className="inline" size={14} />}
                                                    </span>
                                                    <span className="line-clamp-2">{item.message}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="workspace-soft-panel rounded-2xl p-4">
                                    <div className="mb-4">
                                        <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Organize</p>
                                    </div>
                                    <div className="grid gap-4 md:grid-cols-3">
                                        <div>
                                            <label className="mb-2 block text-xs uppercase tracking-[0.1em] text-ink-muted">Category</label>
                                            <div className="flex gap-2">
                                                {(['PERSONAL', 'PROFESSIONAL'] as EntryCategory[]).map((option) => {
                                                    const active = category === option;
                                                    return (
                                                        <button
                                                            key={option}
                                                            type="button"
                                                            onClick={() => handleCategorySelect(option)}
                                                            className={`rounded-xl border px-3 py-2 text-xs uppercase tracking-[0.08em] transition ${
                                                                active
                                                                    ? 'border-primary/40 bg-primary/15 text-primary'
                                                                    : 'workspace-button-outline text-ink-secondary'
                                                            }`}
                                                        >
                                                            {option === 'PERSONAL' ? 'Personal' : 'Professional'}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        <div>
                                            <label className="mb-2 block text-xs uppercase tracking-[0.1em] text-ink-muted">Life Area</label>
                                            <select
                                                value={lifeArea}
                                                onChange={(event) => setLifeArea(normalizeLifeArea(event.target.value, category))}
                                                className="workspace-input w-full rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/35"
                                            >
                                                {availableLifeAreas.map((option) => (
                                                    <option key={option.value} value={option.value} className="bg-surface-1">
                                                        {option.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="mb-2 block text-xs uppercase tracking-[0.1em] text-ink-muted">Collection</label>
                                            <select
                                                value={collectionId || ''}
                                                onChange={(event) => setCollectionId(event.target.value || null)}
                                                className="workspace-input w-full rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/35"
                                            >
                                                <option value="" className="bg-surface-1">No collection</option>
                                                {collections.map((collection) => (
                                                    <option key={collection.id} value={collection.id} className="bg-surface-1">
                                                        {collection.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>
                )}

                {!isQuickMode && !isWhisperMode && !content && !isRecording && (
                    <div className="mt-8 text-center">
                        <button
                            onClick={handleUseStarterPrompt}
                            className="workspace-button-outline mx-auto inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm transition-colors"
                        >
                            <span className="text-ink-muted">{starterPrompt.label}:</span>
                            <span>{starterPrompt.text}</span>
                        </button>
                    </div>
                )}
            </div>

            {/* Floating record bar — replaces mobile bottom bar during recording */}
            {isRecording && (
                <FloatingRecordBar
                    audioLevel={audioLevel}
                    elapsed={recordingElapsed}
                    interimText={interimText}
                    onStop={stopRecording}
                />
            )}

            {!isRecording && (
            <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-[rgba(var(--paper-border),0.92)] bg-[rgba(255,255,255,0.92)] p-3 backdrop-blur-xl md:hidden" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 0.75rem)' }}>
                <div className="flex gap-2">
                    {isQuickMode && (
                        <button
                            onClick={handleFinishLater}
                            className="workspace-button-outline flex-1 rounded-xl px-3 py-3 text-sm font-medium"
                        >
                            Later
                        </button>
                    )}
                    <button
                        onClick={() => handleSave(false)}
                        disabled={isSaving || !content.trim()}
                        className="workspace-button-primary flex-[2] rounded-xl px-5 py-3 font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {isSaving ? 'Saving...' : 'Save'}
                    </button>
                </div>
            </div>
            )}

            {/* ── The Mirror: post-save reflection card ── */}
            <AnimatePresence>
                {mirrorSentence && (
                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 12 }}
                        transition={{ duration: 0.4, ease: 'easeOut' }}
                        className="fixed bottom-24 left-4 right-4 z-50 mx-auto max-w-sm rounded-[1.25rem] border border-[rgba(138,154,111,0.25)] bg-[rgba(248,244,237,0.96)] px-4 py-3 shadow-[0_4px_20px_rgba(92,92,92,0.12)] backdrop-blur-sm"
                    >
                        <p className="text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-[rgb(138,154,111)]">Notive noticed</p>
                        <p className="mt-1 text-[0.82rem] leading-6 text-[rgb(var(--paper-ink))] italic" style={{ fontFamily: 'var(--font-serif, Georgia, serif)' }}>
                            {mirrorSentence}
                        </p>
                        <button
                            onClick={() => {
                                if (mirrorTimerRef.current) clearTimeout(mirrorTimerRef.current);
                                setMirrorSentence(null);
                                router.push(backHref);
                            }}
                            className="mt-1 text-[0.65rem] text-[rgb(107,107,107)] hover:text-[rgb(var(--paper-ink))]"
                            aria-label="Dismiss"
                        >
                            Dismiss
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {draftConflict && (
                <div
                    className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgb(var(--bg-canvas))]/75 p-4 backdrop-blur-sm"
                    onClick={handleKeepDraft}
                    onKeyDown={(e) => { if (e.key === 'Escape') handleKeepDraft(); }}
                >
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="draft-conflict-title"
                        className="workspace-panel w-full max-w-lg rounded-2xl p-5 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <p className="text-xs uppercase tracking-[0.15em] text-ink-muted">Draft Detected</p>
                        <h2 id="draft-conflict-title" className="workspace-heading mt-2 text-xl font-semibold">Keep your existing draft or replace it?</h2>
                        <p className="mt-2 text-sm text-ink-secondary">
                            A saved draft exists for this account. A prompt link was also opened. Choose how to proceed.
                        </p>

                        <div className="mt-5 grid gap-2">
                            <button
                                onClick={handleKeepDraft}
                                className="workspace-button-outline rounded-xl px-4 py-3 text-left text-sm"
                            >
                                Continue existing draft
                            </button>
                            <button
                                onClick={handleReplaceDraftWithPrompt}
                                className="rounded-xl border border-primary/30 bg-primary/15 px-4 py-3 text-left text-sm text-primary hover:bg-primary/25"
                            >
                                Replace draft with prompt
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function NewEntryPage() {
    return (
        <Suspense fallback={<div className="min-h-screen" />}>
            <NewEntryPageContent />
        </Suspense>
    );
}
