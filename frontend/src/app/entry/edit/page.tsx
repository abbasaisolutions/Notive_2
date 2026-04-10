'use client';

import React, { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/form-elements';
import { Spinner } from '@/components/ui';
import { AppPanel } from '@/components/ui/surface';
import useAuthRedirect from '@/hooks/use-auth-redirect';
import useApi from '@/hooks/use-api';
import useContextNavigation from '@/hooks/use-context-navigation';
import useEntryEdit from '@/hooks/use-entry-edit';
import MemoryInsightStrip from '@/components/entry/MemoryInsightStrip';
import { EntryCategory, LIFE_AREA_OPTIONS, normalizeLifeArea } from '@/constants/life-areas';
import { ACCEPTED_IMAGE_UPLOAD_TYPES_ATTR } from '@/utils/image-upload';
import type { IconType } from 'react-icons';
import {
    FiAlertCircle,
    FiArrowLeft,
    FiFrown,
    FiHelpCircle,
    FiMoon,
    FiSmile,
    FiSun,
    FiTrendingUp,
    FiXCircle,
} from 'react-icons/fi';

const TiptapEditor = dynamic(() => import('@/components/editor/TiptapEditor'), {
    ssr: false,
    loading: () => <div className="workspace-soft-panel rounded-2xl h-[400px] animate-pulse" />,
});

const MOODS = [
    { icon: FiSmile, label: 'Happy', value: 'happy' },
    { icon: FiSun, label: 'Calm', value: 'calm' },
    { icon: FiFrown, label: 'Sad', value: 'sad' },
    { icon: FiAlertCircle, label: 'Anxious', value: 'anxious' },
    { icon: FiXCircle, label: 'Frustrated', value: 'frustrated' },
    { icon: FiHelpCircle, label: 'Thoughtful', value: 'thoughtful' },
    { icon: FiTrendingUp, label: 'Motivated', value: 'motivated' },
    { icon: FiMoon, label: 'Tired', value: 'tired' },
] satisfies Array<{ icon: IconType; label: string; value: string }>;

function EditEntryContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const id = searchParams.get('id');
    const fallbackHref = id ? `/entry/view?id=${id}` : '/timeline';
    const { backHref, backLabel, navigateBack } = useContextNavigation(fallbackHref, id ? 'entry details' : 'timeline');
    const { user, isLoading: authLoading, isAuthenticated } = useAuthRedirect();
    const { apiFetch } = useApi();

    const {
        title,
        setTitle,
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
    } = useEntryEdit({
        id,
        userReady: !!user,
        apiFetch,
        navigateToFallback: navigateBack,
        navigateAfterSave: () => router.push(backHref),
    });

    if (authLoading || isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Spinner size="md" />
            </div>
        );
    }

    if (!isAuthenticated) {
        return null;
    }

    if (error && !contentHtml) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center text-center p-4">
                <h1 className="text-2xl font-bold workspace-heading mb-2">Error</h1>
                <p className="text-ink-muted mb-6">{error}</p>
                <Link href={backHref} className="text-primary hover:underline">
                    Return to previous page
                </Link>
            </div>
        );
    }

    const availableLifeAreas = LIFE_AREA_OPTIONS.filter((item) => item.category === category);
    const handleCategorySelect = (nextCategory: EntryCategory) => {
        setCategory(nextCategory);
        setLifeArea((current) => normalizeLifeArea(current, nextCategory));
    };

    return (
        <div className="min-h-screen p-4 md:p-6">
            <div className="max-w-2xl mx-auto">
                {/* ── Top bar ── */}
                <div className="flex items-center justify-between mb-5">
                    <button
                        type="button"
                        onClick={navigateBack}
                        aria-label={backLabel}
                        className="flex items-center gap-1.5 text-ink-muted hover:text-[rgb(var(--text-primary))] transition-colors"
                    >
                        <FiArrowLeft size={18} aria-hidden="true" />
                        <span className="text-sm font-medium">Back</span>
                    </button>
                    <div className="flex items-center gap-3">
                        <span className="text-xs text-ink-muted">
                            {isAutoSaving ? 'Saving…' : hasUnsavedChanges ? 'Unsaved' : lastSaved ? `Saved ${lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                        </span>
                        <Button onClick={handleSave} isLoading={isSaving}>
                            Save
                        </Button>
                    </div>
                </div>

                {error && (
                    <div className="mb-4 workspace-soft-panel text-ink-secondary px-4 py-2.5 rounded-xl text-sm">
                        {error}
                    </div>
                )}

                {/* ── Title ── */}
                <input
                    type="text"
                    placeholder="Title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full ink-title-input text-xl font-bold font-serif focus:outline-none mb-5 bg-transparent"
                />

                {/* ── Editor ── */}
                <TiptapEditor
                    content={contentHtml}
                    onChange={handleEditorChange}
                    placeholder="What's on your mind today?"
                />

                <MemoryInsightStrip
                    className="mt-5"
                    label="What stands out"
                    description="Based on the saved version of this memory. It refreshes after autosave."
                    analysisLine={analysisLine}
                    takeawayLine={takeawayLine}
                    notiveInsights={notiveInsights}
                    topEmotions={topEmotions}
                    depthLabel={depthLabel}
                    growthRatio={growthRatio}
                    storySignal={storySignal}
                />

                <AppPanel className="mt-5 space-y-5" tone="soft">
                    <div className="space-y-1">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">Organize this memory</p>
                        <p className="text-sm text-ink-secondary">Keep the note first, then use these controls to sort and polish the rest.</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {(['PERSONAL', 'PROFESSIONAL'] as EntryCategory[]).map((option) => (
                            <button
                                key={option}
                                type="button"
                                onClick={() => handleCategorySelect(option)}
                                className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.06em] transition ${
                                    category === option
                                        ? 'border-primary/45 bg-primary/15 text-primary'
                                        : 'workspace-button-outline text-ink-muted'
                                }`}
                            >
                                {option === 'PERSONAL' ? 'Personal' : 'Pro'}
                            </button>
                        ))}
                        <span className="text-ink-muted/30 text-xs">|</span>
                        <select
                            value={lifeArea}
                            onChange={(event) => setLifeArea(normalizeLifeArea(event.target.value, category))}
                            className="workspace-input rounded-full px-3 py-1.5 text-xs text-ink-secondary focus:outline-none focus:ring-1 focus:ring-primary/30 border border-[rgba(141,123,105,0.18)]"
                        >
                            {availableLifeAreas.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                        <select
                            value={chapterId || ''}
                            onChange={(event) => setChapterId(event.target.value || null)}
                            className="workspace-input rounded-full px-3 py-1.5 text-xs text-ink-secondary focus:outline-none focus:ring-1 focus:ring-primary/30 border border-[rgba(141,123,105,0.18)]"
                        >
                            <option value="">No collection</option>
                            {collections.map((collection) => (
                                <option key={collection.id} value={collection.id}>{collection.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-2">
                        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-ink-muted">Mood</p>
                        <div className="flex flex-wrap gap-1.5">
                            {MOODS.map((m) => (
                                <button
                                    key={m.value}
                                    type="button"
                                    onClick={() => setMood(mood === m.value ? null : m.value)}
                                    title={m.label}
                                    aria-pressed={mood === m.value}
                                    className={`px-3 py-1.5 rounded-full text-xs flex items-center gap-1.5 transition-all ${
                                        mood === m.value
                                            ? 'bg-primary/15 border border-primary/40 text-primary font-medium'
                                            : 'workspace-pill text-ink-muted border border-transparent hover:border-primary/15'
                                    }`}
                                >
                                    <m.icon size={14} aria-hidden="true" />
                                    <span>{m.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <p className="mb-2 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-ink-muted">Tags</p>
                        <div className="flex flex-wrap gap-2 mb-2">
                            {tags.map((tag) => (
                                <span key={tag} className="workspace-pill px-3 py-1 rounded-full text-xs text-ink-secondary flex items-center gap-1.5">
                                    #{tag}
                                    <button type="button" onClick={() => handleRemoveTag(tag)} aria-label={`Remove tag ${tag}`} className="text-ink-muted hover:text-[rgb(var(--text-primary))] leading-none text-sm">&times;</button>
                                </span>
                            ))}
                        </div>
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Add a tag..."
                                value={tagInput}
                                onChange={(e) => setTagInput(e.target.value)}
                                onKeyDown={handleAddTag}
                                className="w-full workspace-input px-3 py-2 rounded-xl text-sm text-[rgb(var(--text-primary))] focus:outline-none focus:ring-1 focus:ring-primary/40"
                            />
                            {!tagInput && (
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[0.65rem] text-ink-muted/50 pointer-events-none">
                                    press Enter to add
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-ink-muted">Cover image</p>
                        {coverImage ? (
                            <div className="relative w-full h-40 rounded-2xl overflow-hidden group">
                                <img src={coverImage} alt="Cover" className="w-full h-full object-cover" />
                                <button
                                    onClick={() => setCoverImage(null)}
                                    aria-label="Remove cover image"
                                    className="absolute top-2 right-2 px-2.5 py-1 rounded-lg bg-black/50 text-white text-xs sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                                >
                                    Remove
                                </button>
                            </div>
                        ) : (
                            <label className="workspace-soft-panel flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[rgba(141,123,105,0.25)] transition-all hover:brightness-[1.04]">
                                <input type="file" accept={ACCEPTED_IMAGE_UPLOAD_TYPES_ATTR} onChange={handleImageUpload} className="hidden" disabled={isUploading} />
                                {isUploading ? <Spinner size="sm" /> : <span className="text-sm text-ink-muted">+ Add cover image</span>}
                            </label>
                        )}
                    </div>
                </AppPanel>
            </div>
        </div>
    );
}

export default function EditEntryPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Spinner size="md" /></div>}>
            <EditEntryContent />
        </Suspense>
    );
}



