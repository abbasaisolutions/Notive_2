'use client';

import React, { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/form-elements';
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
    loading: () => <div className="glass-card rounded-2xl h-[400px] animate-pulse" />,
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
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
        );
    }

    if (!isAuthenticated) {
        return null;
    }

    if (error && !contentHtml) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center text-center p-4">
                <h2 className="text-2xl font-bold text-white mb-2">Error</h2>
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
                            className="p-2 rounded-lg text-ink-muted hover:text-white hover:bg-white/10 transition-all"
                        >
                            <FiArrowLeft size={24} aria-hidden="true" />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold text-white">Edit Entry</h1>
                            <div className="flex items-center gap-2">
                                {lastSaved && <p className="text-xs text-ink-muted">Last saved: {lastSaved.toLocaleTimeString()}</p>}
                                {isAutoSaving && <p className="text-xs text-primary animate-pulse">Saving...</p>}
                                {hasUnsavedChanges && !isAutoSaving && <p className="text-xs text-zinc-300">Unsaved changes</p>}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleSignOut}
                            disabled={isSigningOut}
                            className="px-3 py-2 rounded-xl border border-white/12 bg-surface-2/55 text-xs uppercase tracking-widest text-foreground hover:bg-surface-2/80 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {isSigningOut ? 'Signing Out...' : 'Sign Out'}
                        </button>
                        <Button onClick={handleSave} isLoading={isSaving}>
                            Save Changes
                        </Button>
                    </div>
                </div>

                {error && (
                    <div className="mb-4 bg-surface-2/55 border border-white/15 text-ink-secondary px-4 py-3 rounded-xl text-sm">
                        {error}
                    </div>
                )}

                <div className="mb-6">
                    {coverImage ? (
                        <div className="relative w-full h-48 md:h-64 rounded-2xl overflow-hidden group">
                            <img src={coverImage} alt="Cover" className="w-full h-full object-cover" />
                            <button
                                onClick={() => setCoverImage(null)}
                                className="absolute top-4 right-4 p-2 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-primary/70"
                            >
                                ×
                            </button>
                        </div>
                    ) : (
                        <label className="w-full h-32 rounded-2xl border-2 border-dashed border-white/10 hover:border-primary/50 hover:bg-white/5 flex flex-col items-center justify-center cursor-pointer transition-all group">
                            <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" disabled={isUploading} />
                            {isUploading ? (
                                <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
                            ) : (
                                <span className="text-sm text-ink-muted group-hover:text-white transition-colors">Add Cover Image</span>
                            )}
                        </label>
                    )}
                </div>

                <input
                    type="text"
                    placeholder="Entry title (optional)"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-transparent border-none text-3xl font-bold text-white placeholder-ink-muted focus:outline-none mb-6"
                />

                <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
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
                                className="w-full rounded-xl border border-white/15 bg-white/[0.03] px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/40"
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
                                className="w-full rounded-xl border border-white/15 bg-white/[0.03] px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/40"
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
                                    : 'bg-white/5 text-ink-secondary hover:bg-white/10'
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
                            <span key={tag} className="px-3 py-1 rounded-full bg-white/10 text-sm text-foreground flex items-center gap-2">
                                #{tag}
                                <button type="button" onClick={() => handleRemoveTag(tag)} className="text-ink-muted hover:text-white">
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
                        className="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-ink-muted focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                </div>
            </div>
        </div>
    );
}

export default function EditEntryPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>}>
            <EditEntryContent />
        </Suspense>
    );
}



