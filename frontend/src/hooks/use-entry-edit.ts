'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { API_URL } from '@/constants/config';
import { useAutoSave } from '@/hooks/use-auto-save';
import { getErrorMessage } from '@/utils/http';
import { prepareImageForUpload } from '@/utils/image-upload';
import {
    DEFAULT_LIFE_AREA_BY_CATEGORY,
    EntryCategory,
    normalizeCategory,
    normalizeLifeArea,
} from '@/constants/life-areas';
import { useToast } from '@/context/toast-context';
import { normalizeTag, isValidTag } from '@/utils/tags';
import { MIN_CHARACTERS_FOR_ENTRY_SAVE } from '@/constants/entry-requirements';
import type { StorySignal } from '@/utils/story-engine';
import type { MemoryNotiveInsight, MemoryTopEmotion } from '@/components/entry/memory-insight-types';

type ApiFetch = (path: string, options?: RequestInit & { retryOnUnauthorized?: boolean }) => Promise<Response>;

type UseEntryEditArgs = {
    id: string | null;
    userReady: boolean;
    apiFetch: ApiFetch;
    navigateToFallback: () => void;
    navigateAfterSave: () => void;
};

type CollectionOption = {
    id: string;
    name: string;
};

type EditableEntryResponse = {
    title?: string | null;
    content?: string | null;
    contentHtml?: string | null;
    mood?: string | null;
    tags?: string[];
    category?: string | null;
    lifeArea?: string | null;
    chapterId?: string | null;
    coverImage?: string | null;
    analysisLine?: string | null;
    takeawayLine?: string | null;
    notiveInsights?: MemoryNotiveInsight[] | null;
    topEmotions?: MemoryTopEmotion[];
    depthLabel?: string | null;
    growthRatio?: number | null;
    storySignal?: StorySignal;
};

const isQuickCheckInEntry = (title: string, tags: string[]) => {
    const normalizedTitle = title.trim().toLowerCase();
    if (normalizedTitle === 'quick check-in' || normalizedTitle === 'quick check in') return true;

    return tags.some((tag) => {
        const normalizedTag = tag.trim().toLowerCase();
        return normalizedTag === 'check-in' || normalizedTag === 'daily-checkin' || normalizedTag === 'daily check-in';
    });
};

export function useEntryEdit({
    id,
    userReady,
    apiFetch,
    navigateToFallback,
    navigateAfterSave,
}: UseEntryEditArgs) {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [initialContent, setInitialContent] = useState('');
    const [contentHtml, setContentHtml] = useState('');
    const [mood, setMood] = useState<string | null>(null);
    const [tags, setTags] = useState<string[]>([]);
    const [category, setCategory] = useState<EntryCategory>('PERSONAL');
    const [lifeArea, setLifeArea] = useState<string>(DEFAULT_LIFE_AREA_BY_CATEGORY.PERSONAL);
    const [chapterId, setChapterId] = useState<string | null>(null);
    const [collections, setCollections] = useState<CollectionOption[]>([]);
    const [tagInput, setTagInput] = useState('');
    const [coverImage, setCoverImage] = useState<string | null>(null);
    const [analysisLine, setAnalysisLine] = useState<string | null>(null);
    const [takeawayLine, setTakeawayLine] = useState<string | null>(null);
    const [notiveInsights, setNotiveInsights] = useState<MemoryNotiveInsight[] | null>(null);
    const [topEmotions, setTopEmotions] = useState<MemoryTopEmotion[]>([]);
    const [depthLabel, setDepthLabel] = useState<string | null>(null);
    const [growthRatio, setGrowthRatio] = useState<number | null>(null);
    const [storySignal, setStorySignal] = useState<StorySignal | undefined>(undefined);
    const [isUploading, setIsUploading] = useState(false);
    const toast = useToast();
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const isShortEntryAllowed = isQuickCheckInEntry(title, tags);

    const applyEntryData = useCallback((entry: EditableEntryResponse) => {
        const entryCategory = normalizeCategory(entry.category);
        const normalizedInsights = Array.isArray(entry.notiveInsights)
            ? entry.notiveInsights
                .map((insight) => {
                    if (!insight || typeof insight.text !== 'string' || !insight.text.trim()) return null;

                    return {
                        type: insight.type === 'lesson' || insight.type === 'strength' ? insight.type : 'thread',
                        text: insight.text.trim(),
                        ...(typeof insight.doodle === 'string' && insight.doodle ? { doodle: insight.doodle } : {}),
                    } satisfies MemoryNotiveInsight;
                })
                .filter((insight): insight is MemoryNotiveInsight => Boolean(insight))
            : null;
        const normalizedTopEmotions = Array.isArray(entry.topEmotions)
            ? entry.topEmotions
                .filter((emotion) => emotion && typeof emotion.emotion === 'string' && typeof emotion.intensity === 'number')
                .map((emotion) => ({
                    emotion: emotion.emotion.trim(),
                    intensity: emotion.intensity,
                }))
                .filter((emotion) => emotion.emotion)
            : [];

        setTitle(entry.title || '');
        setContent(entry.content || '');
        setInitialContent(entry.content || '');
        setContentHtml(entry.contentHtml || '');
        setMood(entry.mood ?? null);
        setTags(Array.isArray(entry.tags) ? entry.tags : []);
        setCategory(entryCategory);
        setLifeArea(normalizeLifeArea(entry.lifeArea, entryCategory));
        setChapterId(entry.chapterId || null);
        setCoverImage(entry.coverImage || null);
        setAnalysisLine(typeof entry.analysisLine === 'string' ? entry.analysisLine : null);
        setTakeawayLine(typeof entry.takeawayLine === 'string' ? entry.takeawayLine : null);
        setNotiveInsights(normalizedInsights);
        setTopEmotions(normalizedTopEmotions);
        setDepthLabel(typeof entry.depthLabel === 'string' ? entry.depthLabel : null);
        setGrowthRatio(typeof entry.growthRatio === 'number' ? entry.growthRatio : null);
        setStorySignal(entry.storySignal);
    }, []);

    useEffect(() => {
        if (!id) {
            navigateToFallback();
            return;
        }
        if (!userReady) return;

        const controller = new AbortController();
        let mounted = true;

        const fetchEntry = async () => {
            try {
                const response = await apiFetch(`${API_URL}/entries/${id}`, { signal: controller.signal });
                if (!response.ok) {
                    throw new Error(await getErrorMessage(response, 'Couldn\u2019t load this note.'));
                }

                const data = await response.json();
                const entry = data.entry;

                if (!mounted) return;
                applyEntryData(entry);
            } catch (err: any) {
                if (controller.signal.aborted) return;
                setError(err.message || 'Couldn\u2019t load this note.');
            } finally {
                if (mounted) setIsLoading(false);
            }
        };

        fetchEntry();
        return () => {
            mounted = false;
            controller.abort();
        };
    }, [id, userReady, apiFetch, navigateToFallback, applyEntryData]);

    useEffect(() => {
        if (!userReady) return;

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
            } catch (err) {
                if (controller.signal.aborted) return;
                console.error('Failed to fetch collections:', err);
            }
        };

        fetchCollections();

        return () => {
            mounted = false;
            controller.abort();
        };
    }, [userReady, apiFetch]);

    const handleEditorChange = useCallback((text: string, html: string) => {
        setContent(text);
        setContentHtml(html);
    }, []);

    const handleAddTag = useCallback((e: React.KeyboardEvent) => {
        if (e.key !== 'Enter' || !tagInput.trim()) return;
        e.preventDefault();
        const normalized = normalizeTag(tagInput);
        if (normalized && isValidTag(normalized) && !tags.some(t => normalizeTag(t) === normalized)) {
            setTags([...tags, normalized]);
        }
        setTagInput('');
    }, [tagInput, tags]);

    const handleRemoveTag = useCallback((tagToRemove: string) => {
        setTags(tags.filter((t) => t !== tagToRemove));
    }, [tags]);

    const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';

        setError('');
        setIsUploading(true);

        try {
            const prepared = await prepareImageForUpload(file, 'entry');
            const formData = new FormData();
            formData.append('file', prepared.file, prepared.file.name);

            const response = await apiFetch(`${API_URL}/files/upload`, {
                method: 'POST',
                body: formData,
            });
            if (!response.ok) {
                throw new Error(await getErrorMessage(response, 'Couldn\u2019t upload that image.'));
            }
            const data = await response.json();
            setCoverImage(data.url);
        } catch (err: any) {
            setError(err.message || 'Couldn\u2019t upload that image.');
        } finally {
            setIsUploading(false);
        }
    }, [apiFetch]);

    const saveEntry = useCallback(async (data: {
        title: string;
        content: string;
        contentHtml: string;
        mood: string | null;
        tags: string[];
        coverImage: string | null;
        category: EntryCategory;
        lifeArea: string;
        chapterId: string | null;
    }) => {
        const normalizedContent = data.content.trim();
        const canSaveShortExistingContent = normalizedContent === initialContent.trim();

        if (!id || (normalizedContent.length < MIN_CHARACTERS_FOR_ENTRY_SAVE && !canSaveShortExistingContent && !isShortEntryAllowed)) return;

        const response = await apiFetch(`${API_URL}/entries/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            throw new Error(await getErrorMessage(response, 'Couldn\u2019t save your note.'));
        }

        const responseData = await response.json().catch(() => null);
        if (responseData?.entry) {
            applyEntryData(responseData.entry);
        }
        setLastSaved(new Date());
    }, [id, apiFetch, initialContent, isShortEntryAllowed, applyEntryData]);

    const autoSavePayload = useMemo(() => ({
        title,
        content,
        contentHtml,
        mood,
        tags,
        coverImage,
        category,
        lifeArea,
        chapterId,
    }), [title, content, contentHtml, mood, tags, coverImage, category, lifeArea, chapterId]);

    const { isSaving: isAutoSaving, hasUnsavedChanges } = useAutoSave({
        data: autoSavePayload,
        onSave: saveEntry,
        enabled: !isLoading && (
            content.trim().length >= MIN_CHARACTERS_FOR_ENTRY_SAVE
            || content.trim() === initialContent.trim()
            || isShortEntryAllowed
        ),
    });

    const handleSave = useCallback(async () => {
        const normalizedContent = content.trim();

        if (!normalizedContent) {
            setError('Please write something before saving.');
            return;
        }

        if (
            normalizedContent.length < MIN_CHARACTERS_FOR_ENTRY_SAVE
            && normalizedContent !== initialContent.trim()
            && !isShortEntryAllowed
        ) {
            setError(`Please write at least ${MIN_CHARACTERS_FOR_ENTRY_SAVE} characters before saving.`);
            return;
        }

        setIsSaving(true);
        setError('');

        try {
            await saveEntry({
                title,
                content,
                contentHtml,
                mood,
                tags,
                coverImage,
                category,
                lifeArea,
                chapterId,
            });
            toast.success('Changes saved');
            navigateAfterSave();
        } catch (err: any) {
            const msg = err.message || 'Couldn\u2019t save your note.';
            setError(msg);
            toast.error(msg);
        } finally {
            setIsSaving(false);
        }
    }, [content, title, contentHtml, mood, tags, coverImage, category, lifeArea, chapterId, saveEntry, navigateAfterSave, initialContent, isShortEntryAllowed]);

    return {
        title,
        setTitle,
        content,
        contentHtml,
        mood,
        setMood,
        tags,
        category,
        setCategory,
        lifeArea,
        setLifeArea,
        chapterId,
        setChapterId,
        collections,
        tagInput,
        setTagInput,
        coverImage,
        setCoverImage,
        analysisLine,
        takeawayLine,
        notiveInsights,
        topEmotions,
        depthLabel,
        growthRatio,
        storySignal,
        isUploading,
        isSaving,
        isLoading,
        error,
        lastSaved,
        isAutoSaving,
        hasUnsavedChanges,
        handleEditorChange,
        handleAddTag,
        handleRemoveTag,
        handleImageUpload,
        handleSave,
    };
}

export default useEntryEdit;
