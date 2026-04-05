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

export function useEntryEdit({
    id,
    userReady,
    apiFetch,
    navigateToFallback,
    navigateAfterSave,
}: UseEntryEditArgs) {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [contentHtml, setContentHtml] = useState('');
    const [mood, setMood] = useState<string | null>(null);
    const [tags, setTags] = useState<string[]>([]);
    const [category, setCategory] = useState<EntryCategory>('PERSONAL');
    const [lifeArea, setLifeArea] = useState<string>(DEFAULT_LIFE_AREA_BY_CATEGORY.PERSONAL);
    const [chapterId, setChapterId] = useState<string | null>(null);
    const [collections, setCollections] = useState<CollectionOption[]>([]);
    const [tagInput, setTagInput] = useState('');
    const [coverImage, setCoverImage] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const toast = useToast();
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [lastSaved, setLastSaved] = useState<Date | null>(null);

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
                const entryCategory = normalizeCategory(entry.category);
                setTitle(entry.title || '');
                setContent(entry.content || '');
                setContentHtml(entry.contentHtml || '');
                setMood(entry.mood);
                setTags(entry.tags || []);
                setCategory(entryCategory);
                setLifeArea(normalizeLifeArea(entry.lifeArea, entryCategory));
                setChapterId(entry.chapterId || null);
                setCoverImage(entry.coverImage || null);
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
    }, [id, userReady, apiFetch, navigateToFallback]);

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
        if (!tags.includes(tagInput.trim())) {
            setTags([...tags, tagInput.trim()]);
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
        if (!id || !data.content.trim()) return;

        const response = await apiFetch(`${API_URL}/entries/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            throw new Error(await getErrorMessage(response, 'Couldn\u2019t save your note.'));
        }

        setLastSaved(new Date());
    }, [id, apiFetch]);

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
        enabled: !isLoading,
    });

    const handleSave = useCallback(async () => {
        if (!content.trim()) {
            setError('Please write something before saving.');
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
    }, [content, title, contentHtml, mood, tags, coverImage, category, lifeArea, chapterId, saveEntry, navigateAfterSave]);

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
