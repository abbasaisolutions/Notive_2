'use client';

import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
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
import { useGamification } from '@/context/gamification-context';
import { useAuth } from '@/context/auth-context';
import { useRouter, useSearchParams } from 'next/navigation';
import EntryTopBar from '@/components/entry/new/EntryTopBar';
import EntryEditorCard from '@/components/entry/new/EntryEditorCard';
import EntryInsightsPanel from '@/components/entry/new/EntryInsightsPanel';
import { getStarterPrompt, getWritingSuggestions, polishEntryText, polishTitle } from '@/utils/writing-assistant';
import {
    DEFAULT_LIFE_AREA_BY_CATEGORY,
    LIFE_AREA_OPTIONS,
    EntryCategory,
    normalizeCategory,
    normalizeLifeArea,
} from '@/constants/life-areas';
import type { IconType } from 'react-icons';
import {
    FiAlertCircle,
    FiAlertTriangle,
    FiFrown,
    FiHeart,
    FiHelpCircle,
    FiMoon,
    FiSmile,
    FiSun,
    FiTrendingUp,
    FiXCircle,
    FiZap,
} from 'react-icons/fi';

const MOODS = [
    { icon: FiSmile, label: 'Happy', value: 'happy' },
    { icon: FiSun, label: 'Calm', value: 'calm' },
    { icon: FiFrown, label: 'Sad', value: 'sad' },
    { icon: FiAlertCircle, label: 'Anxious', value: 'anxious' },
    { icon: FiXCircle, label: 'Frustrated', value: 'frustrated' },
    { icon: FiHelpCircle, label: 'Thoughtful', value: 'thoughtful' },
    { icon: FiTrendingUp, label: 'Motivated', value: 'motivated' },
    { icon: FiMoon, label: 'Tired', value: 'tired' },
    { icon: FiHeart, label: 'Grateful', value: 'grateful' },
] satisfies Array<{ icon: IconType; label: string; value: string }>;

type DraftConflict = {
    seededText: string;
    seededAudioUrl: string | null;
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

function NewEntryPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, isLoading: authLoading, isAuthenticated } = useAuthRedirect();
    const { logout } = useAuth();
    const { awardXP, refreshStats } = useGamification();
    const { apiFetch } = useApi();
    const { trackEvent } = useTelemetry();
    const { enqueueUpload, processQueue, queueCount, recentUploads, clearUploadResult } = useUploadQueue();
    const { loadDraft, saveDraft, clearDraft } = useEntryDraft(user?.id ?? null);
    const { backHref, backLabel, navigateBack } = useContextNavigation('/dashboard', 'dashboard');
    const isQuickMode = searchParams.get('mode') !== 'full';

    const [content, setContent] = useState('');
    const [contentHtml, setContentHtml] = useState('');
    const contentRef = useRef('');

    const [titleOverride, setTitleOverride] = useState('');
    const [moodOverride, setMoodOverride] = useState<string | null>(null);
    const [tagsOverride, setTagsOverride] = useState<string[]>([]);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [category, setCategory] = useState<EntryCategory>('PERSONAL');
    const [lifeArea, setLifeArea] = useState<string>(DEFAULT_LIFE_AREA_BY_CATEGORY.PERSONAL);
    const [collectionId, setCollectionId] = useState<string | null>(null);
    const [collections, setCollections] = useState<CollectionOption[]>([]);
    const [voiceError, setVoiceError] = useState<string | null>(null);
    const [duplicateCandidates, setDuplicateCandidates] = useState<DuplicateCandidate[]>([]);
    const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
    const [duplicateError, setDuplicateError] = useState('');

    const [isSaving, setIsSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [error, setError] = useState('');
    const [showAdvancedTools, setShowAdvancedTools] = useState(false);
    const [showInsightDetails, setShowInsightDetails] = useState(false);
    const [entryId, setEntryId] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isSigningOut, setIsSigningOut] = useState(false);
    const [draftRestored, setDraftRestored] = useState(false);
    const [pendingSync, setPendingSync] = useState(false);
    const [polishNotice, setPolishNotice] = useState<string | null>(null);
    const [draftConflict, setDraftConflict] = useState<DraftConflict | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const autoSaveTimeoutRef = useRef<NodeJS.Timeout>();
    const polishNoticeTimeoutRef = useRef<NodeJS.Timeout>();
    const draftInitRef = useRef(false);

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

    const handleVoiceFinal = useCallback((text: string) => {
        if (!text.trim()) return;
        const current = contentRef.current;
        const separator = current && !current.endsWith(' ') ? ' ' : '';
        setContent(current + separator + text.trim());
    }, []);

    const {
        isSupported: isVoiceSupported,
        isListening: isRecording,
        interimText,
        error: speechError,
        start: startRecording,
        stop: stopRecording,
    } = useSpeechRecognition({
        language: 'en-US',
        interimResults: true,
        continuous: true,
        autoRestart: true,
        onFinal: handleVoiceFinal,
    });

    useEffect(() => {
        if (speechError) setVoiceError(speechError);
    }, [speechError]);

    useEffect(() => {
        if (!isVoiceSupported) {
            setVoiceError('Speech recognition not supported in this browser.');
        }
    }, [isVoiceSupported]);

    useEffect(() => {
        if (typeof navigator !== 'undefined' && navigator.onLine) {
            processQueue();
        }
    }, [processQueue]);

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
        if (!user || isQuickMode) {
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
                    throw new Error(data?.message || 'Failed to check similar notes');
                }

                setDuplicateCandidates(Array.isArray(data?.duplicates) ? data.duplicates : []);
            } catch (error: any) {
                if (controller.signal.aborted) return;
                console.error('Duplicate detection failed:', error);
                setDuplicateCandidates([]);
                setDuplicateError(error?.message || 'Failed to check similar notes');
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
    }, [apiFetch, content, duplicateCheckTitle, entryId, isQuickMode, user]);

    useEffect(() => {
        return () => {
            if (polishNoticeTimeoutRef.current) {
                clearTimeout(polishNoticeTimeoutRef.current);
            }
        };
    }, []);

    useEffect(() => {
        if (!user || draftInitRef.current) return;
        draftInitRef.current = true;

        const voiceText = searchParams.get('voice');
        const promptText = searchParams.get('prompt');
        const audioParam = searchParams.get('audioUrl');
        const seededText = voiceText || promptText || '';
        const savedDraft = loadDraft();

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
                setDraftRestored(true);
                setPendingSync(savedDraft.pendingSync);
                setDraftConflict({
                    seededText,
                    seededAudioUrl: audioParam || null,
                });
                return;
            }

            setContent(seededText);
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
            setDraftRestored(true);
            setPendingSync(savedDraft.pendingSync);
        }
    }, [user, searchParams, loadDraft, clearDraft, setExtractedData, setAiInsights]);

    const handleKeepDraft = useCallback(() => {
        setDraftConflict(null);
    }, []);

    const handleReplaceDraftWithPrompt = useCallback(() => {
        if (!draftConflict) return;
        setContent(draftConflict.seededText);
        setContentHtml('');
        setTitleOverride('');
        setMoodOverride(null);
        setTagsOverride([]);
        setAudioUrl(draftConflict.seededAudioUrl);
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
            analysis: buildAnalysisPayload(),
            updatedAt: Date.now(),
            pendingSync: pendingSyncOverride,
        });
    }, [
        audioUrl,
        buildAnalysisPayload,
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

    const buildCaptureModeHref = useCallback((mode: 'quick' | 'full') => {
        const params = new URLSearchParams(searchParams.toString());
        if (mode === 'quick') {
            params.set('mode', 'quick');
        } else {
            params.set('mode', 'full');
        }

        const nextQuery = params.toString();
        return nextQuery ? `/entry/new?${nextQuery}` : '/entry/new';
    }, [searchParams]);

    const handleOpenFullStudio = useCallback(() => {
        void trackEvent({
            eventType: 'entry_full_studio_opened',
            value: 'from_quick_note',
            metadata: {
                hasDraftContent: Boolean(content.trim() || titleOverride.trim() || tagsOverride.length > 0 || audioUrl),
            },
        });
        router.replace(buildCaptureModeHref('full'), { scroll: false });
    }, [audioUrl, buildCaptureModeHref, content, router, tagsOverride.length, titleOverride, trackEvent]);

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
            if (!isAutoSave) setError('Please write or speak something before saving.');
            return;
        }

        const offline = typeof navigator !== 'undefined' && !navigator.onLine;
        if (offline) {
            persistDraftSnapshot(true);
            setPendingSync(true);
            if (!isAutoSave) setError('You are offline. Draft saved locally and will sync when online.');
            return;
        }

        setIsSaving(true);
        if (!isAutoSave) setError('');

        const finalTitle = titleOverride || extractedData?.title || null;
        const finalMood = moodOverride || extractedData?.primaryEmotion?.emotion || null;
        const finalTags = tagsOverride.length > 0 ? tagsOverride : (extractedData?.suggestedTags || []);
        const analysis = buildAnalysisPayload();

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
                }),
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || 'Failed to save entry');
            }

            if (!entryId && data.entry?.id) setEntryId(data.entry.id);
            setLastSaved(new Date());
            setPendingSync(false);

            if (!isAutoSave) {
                void trackEvent({
                    eventType: 'entry_saved',
                    value: isQuickMode ? 'quick' : 'full',
                    metadata: {
                        entryId: data.entry?.id || entryId || null,
                        wordCount: content.trim().split(/\s+/).length,
                        hasMood: Boolean(finalMood),
                        hasTags: finalTags.length > 0,
                    },
                });
                localStorage.setItem('lastEntryTime', Date.now().toString());
                if (!entryId) {
                    awardXP(50, 'Entry created');
                    refreshStats();
                }
                clearDraft();
                router.push(backHref);
            } else {
                persistDraftSnapshot(false);
            }
        } catch (err: any) {
            console.error('Save error:', err);
            if (!isAutoSave) setError(err.message || 'Failed to save entry');
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
        buildAnalysisPayload,
        entryId,
        apiFetch,
        awardXP,
        refreshStats,
        clearDraft,
        backHref,
        router,
        persistDraftSnapshot,
        isQuickMode,
        trackEvent,
    ]);

    useEffect(() => {
        if (!content.trim() || isSaving) return;

        if (autoSaveTimeoutRef.current) {
            clearTimeout(autoSaveTimeoutRef.current);
        }

        autoSaveTimeoutRef.current = setTimeout(() => {
            const offline = typeof navigator !== 'undefined' && !navigator.onLine;

            persistDraftSnapshot(pendingSync || offline);

            if (offline) {
                setPendingSync(true);
                return;
            }

            handleSave(true);
        }, 3000);

        return () => {
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
        if (tag && !tagsOverride.includes(tag)) {
            setTagsOverride(prev => [...prev, tag]);
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
        const file = e.target.files?.[0];
        if (!file) return;

        const offline = typeof navigator !== 'undefined' && !navigator.onLine;
        if (offline) {
            await enqueueUpload({
                endpoint: `${API_URL}/files/upload`,
                fieldName: 'file',
                file,
                fileName: file.name,
                fileType: file.type,
            });
            if (fileInputRef.current) fileInputRef.current.value = '';
            setError('You are offline. Image upload queued and will retry when online.');
            return;
        }

        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await apiFetch(`${API_URL}/files/upload`, {
                method: 'POST',
                body: formData,
            });
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to upload image');
            }

            setContent(prev => `${prev}\n![Image](${data.url})\n`);
            if (fileInputRef.current) fileInputRef.current.value = '';
        } catch (err: any) {
            if (typeof navigator !== 'undefined' && !navigator.onLine) {
                await enqueueUpload({
                    endpoint: `${API_URL}/files/upload`,
                    fieldName: 'file',
                    file,
                    fileName: file.name,
                    fileType: file.type,
                });
                setError('Upload queued. We will retry when you are online.');
            } else {
                setError(err.message || 'Failed to upload image');
            }
        } finally {
            setIsUploading(false);
        }
    }, [apiFetch, enqueueUpload]);

    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
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
    const editorPlaceholder = content.trim()
        ? 'Keep going...'
        : `Try this: ${starterPrompt.text}`;

    const handleCategorySelect = (nextCategory: EntryCategory) => {
        setCategory(nextCategory);
        setLifeArea((current) => normalizeLifeArea(current, nextCategory));
    };

    const handleUseStarterPrompt = () => {
        if (content.trim()) return;
        setContent(`${starterPrompt.text}\n\n`);
    };

    const handleSignOut = async () => {
        if (isSigningOut) return;
        setIsSigningOut(true);
        try {
            await logout();
            router.replace('/login');
        } finally {
            setIsSigningOut(false);
        }
    };

    return (
        <div className="entry-studio min-h-screen text-white selection:bg-primary/30">
            <div className="fixed top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[150px] pointer-events-none" />
            <div className="fixed bottom-0 right-1/4 w-64 h-64 bg-secondary/10 rounded-full blur-[120px] pointer-events-none" />

            <div className="max-w-3xl mx-auto px-4 pt-8 pb-28 md:pb-8 relative z-10">
                <EntryTopBar
                    onBack={navigateBack}
                    backLabel={backLabel}
                    isSaving={isSaving}
                    lastSaved={lastSaved}
                    canSave={!isSaving && !!content.trim()}
                    onSave={() => handleSave(false)}
                    onSignOut={handleSignOut}
                    isSigningOut={isSigningOut}
                    error={error}
                    draftRestored={draftRestored}
                    pendingSync={pendingSync}
                    wordCount={wordCount}
                    readingTimeMinutes={readingTimeMinutes}
                    showAdvancedTools={showAdvancedTools}
                    onToggleAdvancedTools={() => setShowAdvancedTools((prev) => !prev)}
                    polishNotice={polishNotice}
                    isQuickMode={isQuickMode}
                    onFinishLater={handleFinishLater}
                    onOpenFullStudio={handleOpenFullStudio}
                />

                <EntryEditorCard
                    isRecording={isRecording}
                    isVoiceSupported={isVoiceSupported}
                    voiceError={voiceError}
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
                    autoFocus={isQuickMode}
                    minimalEditor={isQuickMode}
                    showImageUpload={!isQuickMode}
                />

                {!isQuickMode && (
                    <section className="mb-6 rounded-2xl border border-white/10 bg-surface-2/45 p-4">
                    <button
                        type="button"
                        onClick={() => setShowAdvancedTools((prev) => !prev)}
                        className="w-full text-left"
                    >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Add Details</p>
                                <h3 className="text-sm font-semibold text-white">
                                    Category, collection, polish, mood, tags, and AI insight
                                </h3>
                                <p className="mt-1 text-sm text-ink-secondary">
                                    Start with writing. Open this when you want to add structure or explore signals.
                                </p>
                            </div>
                            <span className="rounded-xl border border-white/15 bg-white/[0.03] px-3 py-2 text-xs uppercase tracking-[0.08em] text-ink-secondary">
                                {showAdvancedTools ? 'Hide Details' : 'Open Details'}
                            </span>
                        </div>
                    </button>

                    <div className={`transition-all duration-300 ease-in-out ${showAdvancedTools ? 'max-h-[2400px] opacity-100 mt-4' : 'max-h-0 opacity-0 overflow-hidden'}`}>
                        <div className="space-y-4 border-t border-white/10 pt-4">
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
                                                            : 'border-white/15 bg-white/[0.03] text-ink-secondary hover:text-white'
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
                                        className="w-full rounded-xl border border-white/15 bg-white/[0.03] px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/35"
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
                                        className="w-full rounded-xl border border-white/15 bg-white/[0.03] px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/35"
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

                            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Enhance Writing</p>
                                        <p className="text-sm text-ink-secondary">
                                            Polish grammar and spacing only when you want a cleanup pass.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handlePolishWriting}
                                        disabled={!content.trim()}
                                        className="rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2 text-sm text-white hover:bg-white/[0.08] disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Polish Writing
                                    </button>
                                </div>
                                {!content.trim() && (
                                    <p className="mt-3 text-xs text-ink-muted">
                                        Write a few lines first to unlock suggestions, mood, tags, and AI insight.
                                    </p>
                                )}
                            </div>

                            {content.trim().length > 0 && writingSuggestions.length > 0 && (
                                <div className="rounded-2xl border border-white/10 bg-surface-2/45 p-4">
                                    <div className="mb-2 flex items-center justify-between gap-2">
                                        <div className="text-xs uppercase tracking-[0.12em] text-ink-muted">Writing Signals</div>
                                        <span className="rounded-full border border-white/15 bg-white/[0.03] px-2 py-0.5 text-xs uppercase tracking-[0.08em] text-ink-secondary">
                                            {writingSuggestions.length}
                                        </span>
                                    </div>
                                    <div className="space-y-2">
                                        {writingSuggestions.map((item) => (
                                            <div
                                                key={item.id}
                                                className="rounded-xl border border-white/12 bg-surface-2/55 px-3 py-2 text-sm text-foreground"
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

                            <EntryInsightsPanel
                                showDetails={showInsightDetails}
                                setShowDetails={setShowInsightDetails}
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
                        </div>
                    </div>
                    </section>
                )}

                {!isQuickMode && !content && !isRecording && (
                    <div className="mt-12 text-center">
                        <div className="mx-auto max-w-xl rounded-2xl border border-white/10 bg-surface-2/40 p-5">
                            <div className="mb-2 text-xs uppercase tracking-[0.12em] text-ink-muted">{starterPrompt.label}</div>
                            <p className="text-sm text-ink-secondary">{starterPrompt.text}</p>
                            <div className="mt-4 flex items-center justify-center gap-2">
                                <button
                                    onClick={handleUseStarterPrompt}
                                    className="rounded-xl border border-primary/35 bg-primary/15 px-3 py-2 text-sm text-primary hover:bg-primary/25 transition-colors"
                                >
                                    Use Prompt
                                </button>
                                <span className="text-xs text-ink-muted">or tap mic to dictate</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-surface-1/90 backdrop-blur-xl p-3 md:hidden">
                <div className={`grid gap-2 ${isQuickMode ? 'grid-cols-2' : 'grid-cols-[1fr_1.6fr]'}`}>
                    <button
                        onClick={isQuickMode ? handleFinishLater : () => setShowAdvancedTools((prev) => !prev)}
                        className="px-3 py-3 rounded-xl bg-surface-2/70 border border-white/15 text-foreground text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isQuickMode ? 'Finish Later' : (showAdvancedTools ? 'Hide Details' : 'Add Details')}
                    </button>
                    <button
                        onClick={() => handleSave(false)}
                        disabled={isSaving || !content.trim()}
                        className="px-5 py-3 rounded-xl primary-cta text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        {isSaving ? 'Saving...' : (entryId ? 'Update Note' : 'Save Note')}
                    </button>
                </div>
            </div>

            {draftConflict && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-surface-1/95 p-5 shadow-2xl">
                        <p className="text-xs uppercase tracking-[0.15em] text-ink-muted">Draft Detected</p>
                        <h2 className="mt-2 text-xl font-semibold text-white">Keep your existing draft or replace it?</h2>
                        <p className="mt-2 text-sm text-ink-secondary">
                            A saved draft exists for this account. A prompt link was also opened. Choose how to proceed.
                        </p>

                        <div className="mt-5 grid gap-2">
                            <button
                                onClick={handleKeepDraft}
                                className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-left text-sm text-white hover:bg-white/10"
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


