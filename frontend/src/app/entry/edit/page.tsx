'use client';

import React, { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/form-elements';
import { Spinner } from '@/components/ui';
import useAuthRedirect from '@/hooks/use-auth-redirect';
import useApi from '@/hooks/use-api';
import useContextNavigation from '@/hooks/use-context-navigation';
import useEntryEdit from '@/hooks/use-entry-edit';
import { useAuth } from '@/context/auth-context';
import { EntryCategory, LIFE_AREA_OPTIONS, normalizeLifeArea } from '@/constants/life-areas';
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
    const { logout } = useAuth();
    const { apiFetch } = useApi();
    const [isSigningOut, setIsSigningOut] = useState(false);

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

    const availableLifeAreas = LIFE_AREA_OPTIONS.filter((item) => item.category === category);
    const handleCategorySelect = (nextCategory: EntryCategory) => {
        setCategory(nextCategory);
        setLifeArea((current) => normalizeLifeArea(current, nextCategory));
    };

    return (
        <div className="min-h-screen p-4 md:p-8">
            <div className="fixed top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[150px] pointer-events-none" />

            <div className="max-w-4xl mx-auto relative z-10">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <button
                            type="button"
                            onClick={navigateBack}
                            aria-label={backLabel}
                            title={backLabel}
                            className="p-2 rounded-lg text-ink-muted hover:text-[rgb(var(--text-primary))] hover:bg-white/10 transition-all"
                        >
                            <FiArrowLeft size={24} aria-hidden="true" />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold workspace-heading">Edit Entry</h1>
                            <div className="flex items-center gap-2">
                                {lastSaved && <p className="text-xs text-ink-muted">Last saved: {lastSaved.toLocaleTimeString()}</p>}
                                {isAutoSaving && <p className="text-xs text-primary animate-pulse">Saving...</p>}
                                {hasUnsavedChanges && !isAutoSaving && <p className="text-xs text-ink-secondary">Unsaved changes</p>}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleSignOut}
                            disabled={isSigningOut}
                            className="workspace-button-outline px-3 py-2 rounded-xl text-xs uppercase tracking-widest text-ink-secondary hover:text-[rgb(var(--text-primary))] disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {isSigningOut ? 'Signing Out...' : 'Sign Out'}
                        </button>
                        <Button onClick={handleSave} isLoading={isSaving}>
                            Save Changes
                        </Button>
                    </div>
                </div>

                {error && (
                    <div className="mb-4 workspace-soft-panel text-ink-secondary px-4 py-3 rounded-xl text-sm">
                        {error}
                    </div>
                )}

                <div className="mb-6">
                    {coverImage ? (
                        <div className="relative w-full h-48 md:h-64 rounded-2xl overflow-hidden group">
                            <img src={coverImage} alt="Cover" className="w-full h-full object-cover" />
                            <button
                                onClick={() => setCoverImage(null)}
                                aria-label="Remove cover image"
                                className="absolute top-4 right-4 p-2 bg-[rgb(var(--surface-2))]/80 text-[rgb(var(--text-strong))] rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[rgb(var(--brand))]/70"
                            >
                                ×
                            </button>
                        </div>
                    ) : (
                        <label className="workspace-soft-panel w-full h-32 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all group hover:brightness-[1.05]">
                            <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" disabled={isUploading} />
                            {isUploading ? (
                                <Spinner size="sm" />
                            ) : (
                                <span className="text-sm text-ink-muted group-hover:text-[rgb(var(--text-primary))] transition-colors">Add Cover Image</span>
                            )}
                        </label>
                    )}
                </div>

                <input
                    type="text"
                    placeholder="Entry title (optional)"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full ink-title-input text-xl md:text-3xl font-bold font-serif focus:outline-none mb-6 bg-transparent"
                />

                <div className="mb-6 workspace-soft-panel rounded-2xl p-4">
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
                                                    ? 'border-primary/45 bg-primary/15 text-primary'
                                                    : 'workspace-button-outline text-ink-secondary hover:text-[rgb(var(--text-primary))]'
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
                                className="w-full workspace-input rounded-xl px-3 py-2 text-sm text-[rgb(var(--text-primary))] focus:outline-none focus:ring-2 focus:ring-primary/40"
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
                                value={chapterId || ''}
                                onChange={(event) => setChapterId(event.target.value || null)}
                                className="w-full workspace-input rounded-xl px-3 py-2 text-sm text-[rgb(var(--text-primary))] focus:outline-none focus:ring-2 focus:ring-primary/40"
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

                <div className="mb-6">
                    <label className="block text-sm font-medium text-ink-muted mb-2">How are you feeling?</label>
                    <div className="flex flex-wrap gap-2">
                        {MOODS.map((m) => (
                            <button
                                key={m.value}
                                type="button"
                                onClick={() => setMood(mood === m.value ? null : m.value)}
                                className={`px-3 py-2 rounded-xl text-sm flex items-center gap-2 transition-all ${mood === m.value
                                    ? 'bg-primary text-white'
                                    : 'workspace-pill text-ink-secondary'
                                    }`}
                            >
                                <m.icon size={14} aria-hidden="true" />
                                <span>{m.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <TiptapEditor
                    content={contentHtml}
                    onChange={handleEditorChange}
                    placeholder="What's on your mind today?"
                />

                <div className="mt-6">
                    <label className="block text-sm font-medium text-ink-muted mb-2">Tags</label>
                    <div className="flex flex-wrap gap-2 mb-2">
                        {tags.map((tag) => (
                            <span key={tag} className="workspace-pill px-3 py-1 rounded-full text-sm text-ink-secondary flex items-center gap-2">
                                #{tag}
                                <button type="button" onClick={() => handleRemoveTag(tag)} aria-label={`Remove tag ${tag}`} className="text-ink-muted hover:text-[rgb(var(--text-primary))]">
                                    ×
                                </button>
                            </span>
                        ))}
                    </div>
                    <input
                        type="text"
                        placeholder="Add a tag and press Enter..."
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={handleAddTag}
                        className="w-full workspace-input px-4 py-2 rounded-xl text-[rgb(var(--text-primary))] focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                </div>
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



