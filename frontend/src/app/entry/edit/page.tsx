'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useAuth } from '@/context/auth-context';
import { Button } from '@/components/ui/form-elements';
import { useAutoSave } from '@/hooks/use-auto-save';
import { MOOD_ICONS } from '@/constants/moods';
import RewriteToolbar from '@/components/editor/RewriteToolbar';

// Dynamic import to avoid SSR issues with Tiptap
const TiptapEditor = dynamic(() => import('@/components/editor/TiptapEditor'), {
    ssr: false,
    loading: () => <div className="glass-card rounded-2xl h-[400px] animate-pulse" />,
});

const MOODS = [
    { icon: MOOD_ICONS.happy, label: 'Happy', value: 'happy' },
    { icon: MOOD_ICONS.calm, label: 'Calm', value: 'calm' },
    { icon: MOOD_ICONS.sad, label: 'Sad', value: 'sad' },
    { icon: MOOD_ICONS.anxious, label: 'Anxious', value: 'anxious' },
    { icon: MOOD_ICONS.frustrated, label: 'Frustrated', value: 'frustrated' },
    { icon: MOOD_ICONS.thoughtful, label: 'Thoughtful', value: 'thoughtful' },
    { icon: MOOD_ICONS.motivated, label: 'Motivated', value: 'motivated' },
    { icon: MOOD_ICONS.tired, label: 'Tired', value: 'tired' },
];

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

function EditEntryContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const id = searchParams.get('id');
    const { user, accessToken, isLoading: authLoading } = useAuth();
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [contentHtml, setContentHtml] = useState('');
    const [mood, setMood] = useState<string | null>(null);
    const [tags, setTags] = useState<string[]>([]);
    const [tagInput, setTagInput] = useState('');
    const [coverImage, setCoverImage] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [lastSaved, setLastSaved] = useState<Date | null>(null);

    useEffect(() => {
        if (!id) {
            router.push('/dashboard');
            return;
        }

        const fetchEntry = async () => {
            if (!accessToken) return;

            try {
                const response = await fetch(`${API_URL}/entries/${id}`, {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                    },
                });

                if (!response.ok) {
                    throw new Error('Failed to fetch entry');
                }

                const data = await response.json();
                const entry = data.entry;

                setTitle(entry.title || '');
                setContent(entry.content || '');
                setContentHtml(entry.contentHtml || '');
                setMood(entry.mood);
                setTags(entry.tags || []);
                setCoverImage(entry.coverImage || null);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };

        if (user) {
            fetchEntry();
        }
    }, [user, accessToken, id, router]);

    const handleEditorChange = (text: string, html: string) => {
        setContent(text);
        setContentHtml(html);
    };

    const handleAddTag = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && tagInput.trim()) {
            e.preventDefault();
            if (!tags.includes(tagInput.trim())) {
                setTags([...tags, tagInput.trim()]);
            }
            setTagInput('');
        }
    };

    const handleRemoveTag = (tagToRemove: string) => {
        setTags(tags.filter((t) => t !== tagToRemove));
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        const formData = new FormData();
        formData.append('image', file);

        try {
            const response = await fetch(`${API_URL}/entries/upload`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
                body: formData,
            });

            if (!response.ok) throw new Error('Upload failed');

            const data = await response.json();
            setCoverImage(data.url);
        } catch (err) {
            console.error('Upload error:', err);
            setError('Failed to upload image');
        } finally {
            setIsUploading(false);
        }
    };

    const saveEntry = async (data: any) => {
        if (!id) return;
        if (!data.content.trim()) return;

        const response = await fetch(`${API_URL}/entries/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            const resData = await response.json();
            throw new Error(resData.message || 'Failed to update entry');
        }

        setLastSaved(new Date());
    };

    const { isSaving: isAutoSaving, hasUnsavedChanges } = useAutoSave({
        data: { title, content, contentHtml, mood, tags, coverImage },
        onSave: saveEntry,
        enabled: true,
    });

    const handleSave = async () => {
        if (!content.trim()) {
            setError('Please write something before saving.');
            return;
        }

        setIsSaving(true);
        setError('');

        try {
            await saveEntry({ title, content, contentHtml, mood, tags, coverImage });
            router.push(`/entry/view?id=${id}`);
        } catch (err: any) {
            setError(err.message || 'Failed to update entry');
        } finally {
            setIsSaving(false);
        }
    };

    if (authLoading || isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
        );
    }

    if (!user) {
        router.push('/login');
        return null;
    }

    if (error) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center text-center p-4">
                <h2 className="text-2xl font-bold text-white mb-2">Error</h2>
                <p className="text-slate-400 mb-6">{error}</p>
                <Link href="/dashboard" className="text-primary hover:underline">
                    Return to Dashboard
                </Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen p-4 md:p-8">
            {/* Background Glow */}
            <div className="fixed top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[150px] pointer-events-none" />

            <div className="max-w-4xl mx-auto relative z-10">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <Link
                            href={`/entry/view?id=${id}`}
                            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="m12 19-7-7 7-7" />
                                <path d="M19 12H5" />
                            </svg>
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold text-white">Edit Entry</h1>
                            <div className="flex items-center gap-2">
                                {lastSaved && (
                                    <p className="text-xs text-slate-500">
                                        Last saved: {lastSaved.toLocaleTimeString()}
                                    </p>
                                )}
                                {isAutoSaving && (
                                    <p className="text-xs text-primary animate-pulse">Saving...</p>
                                )}
                            </div>
                        </div>
                    </div>
                    <Button onClick={handleSave} isLoading={isSaving}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                            <polyline points="17 21 17 13 7 13 7 21" />
                            <polyline points="7 3 7 8 15 8" />
                        </svg>
                        Save Changes
                    </Button>
                </div>

                {error && (
                    <div className="mb-4 bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm">
                        {error}
                    </div>
                )}

                {/* Cover Image Upload */}
                <div className="mb-6">
                    {coverImage ? (
                        <div className="relative w-full h-48 md:h-64 rounded-2xl overflow-hidden group">
                            <img src={coverImage} alt="Cover" className="w-full h-full object-cover" />
                            <button
                                onClick={() => setCoverImage(null)}
                                className="absolute top-4 right-4 p-2 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/80"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                            </button>
                        </div>
                    ) : (
                        <label className="w-full h-32 rounded-2xl border-2 border-dashed border-white/10 hover:border-primary/50 hover:bg-white/5 flex flex-col items-center justify-center cursor-pointer transition-all group">
                            <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" disabled={isUploading} />
                            {isUploading ? (
                                <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
                            ) : (
                                <>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400 group-hover:text-primary mb-2 transition-colors">
                                        <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                                        <circle cx="9" cy="9" r="2" />
                                        <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                                    </svg>
                                    <span className="text-sm text-slate-400 group-hover:text-white transition-colors">Add Cover Image</span>
                                </>
                            )}
                        </label>
                    )}
                </div>

                {/* Title Input */}
                <input
                    type="text"
                    placeholder="Entry title (optional)"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-transparent border-none text-3xl font-bold text-white placeholder-slate-600 focus:outline-none mb-6"
                />

                {/* Mood Selector */}
                <div className="mb-6">
                    <label className="block text-sm font-medium text-slate-400 mb-2">How are you feeling?</label>
                    <div className="flex flex-wrap gap-2">
                        {MOODS.map((m) => (
                            <button
                                key={m.value}
                                type="button"
                                onClick={() => setMood(mood === m.value ? null : m.value)}
                                className={`px-3 py-2 rounded-xl text-sm flex items-center gap-2 transition-all ${mood === m.value
                                    ? 'bg-primary text-white'
                                    : 'bg-white/5 text-slate-300 hover:bg-white/10'
                                    }`}
                            >
                                {(() => {
                                    const MoodIcon = m.icon;
                                    return <MoodIcon className="w-4 h-4 text-white" />;
                                })()}
                                <span>{m.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Rewrite Toolbar */}
                <div className="mb-4">
                    <RewriteToolbar 
                        content={content}
                        onRewrite={(newContent) => {
                            setContent(newContent);
                            setContentHtml(`<p>${newContent}</p>`);
                        }}
                        disabled={isSaving}
                    />
                </div>

                {/* Editor */}
                <TiptapEditor
                    content={contentHtml} // Pass initial HTML content
                    onChange={handleEditorChange}
                    placeholder="What's on your mind today?"
                />

                {/* Tags */}
                <div className="mt-6">
                    <label className="block text-sm font-medium text-slate-400 mb-2">Tags</label>
                    <div className="flex flex-wrap gap-2 mb-2">
                        {tags.map((tag) => (
                            <span
                                key={tag}
                                className="px-3 py-1 rounded-full bg-white/10 text-sm text-slate-200 flex items-center gap-2"
                            >
                                #{tag}
                                <button
                                    type="button"
                                    onClick={() => handleRemoveTag(tag)}
                                    className="text-slate-400 hover:text-white"
                                >
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
                        className="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50"
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
