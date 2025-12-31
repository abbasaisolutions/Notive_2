'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/auth-context';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

interface Entry {
    id: string;
    title: string | null;
    content: string;
    contentHtml: string | null;
    coverImage: string | null;
    audioUrl?: string | null;
    mood: string | null;
    tags: string[];
    chapterId: string | null;
    createdAt: string;
    updatedAt: string;
}

function EntryDetailContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const id = searchParams.get('id');
    const { user, accessToken, isLoading: authLoading } = useAuth();
    const [entry, setEntry] = useState<Entry | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [shareUrl, setShareUrl] = useState<string | null>(null);
    const [isCopied, setIsCopied] = useState(false);
    const [isSharing, setIsSharing] = useState(false);

    useEffect(() => {
        if (!id) {
            router.push('/dashboard');
            return;
        }

        const fetchEntry = async () => {
            if (!accessToken) return;

            try {
                const response = await fetch(`${API_URL}/entries/${id}`, {
                    headers: { Authorization: `Bearer ${accessToken}` },
                });

                if (response.ok) {
                    const data = await response.json();
                    setEntry(data.entry);
                } else {
                    router.push('/dashboard');
                }
            } catch (error) {
                console.error('Failed to fetch entry:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchEntry();
    }, [accessToken, id, router]);

    const handleShare = async () => {
        if (!id) return;
        setIsSharing(true);
        try {
            const response = await fetch(`${API_URL}/share/entry/${id}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${accessToken}`,
                },
            });

            if (response.ok) {
                const data = await response.json();
                const fullUrl = `${window.location.origin}${data.url}`;
                setShareUrl(fullUrl);
                await navigator.clipboard.writeText(fullUrl);
                setIsCopied(true);
                setTimeout(() => setIsCopied(false), 3000);
            }
        } catch (error) {
            console.error('Failed to create share link:', error);
        } finally {
            setIsSharing(false);
        }
    };

    const handleDelete = async () => {
        if (!id) return;
        if (!confirm('Are you sure you want to delete this entry?')) return;

        try {
            const response = await fetch(`${API_URL}/entries/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${accessToken}` },
            });

            if (response.ok) {
                router.push('/dashboard');
            }
        } catch (error) {
            console.error('Failed to delete entry:', error);
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
        if (typeof window !== 'undefined') router.push('/login');
        return null;
    }

    if (!entry) return null;

    return (
        <div className="min-h-screen p-4 md:p-8">
            <div className="fixed top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[150px] pointer-events-none" />

            <div className="max-w-3xl mx-auto relative z-10">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <Link href="/dashboard" className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m12 19-7-7 7-7" /><path d="M19 12H5" />
                        </svg>
                    </Link>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleShare}
                            disabled={isSharing}
                            className="px-4 py-2 rounded-xl bg-white/5 text-slate-300 hover:bg-white/10 transition-all flex items-center gap-2"
                        >
                            {isCopied ? (
                                <><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-400"><path d="M20 6 9 17l-5-5" /></svg>Copied!</>
                            ) : isSharing ? (
                                <><div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />Sharing...</>
                            ) : (
                                <><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" x2="15.42" y1="13.51" y2="17.49" /><line x1="15.41" x2="8.59" y1="6.51" y2="10.49" /></svg>Share</>
                            )}
                        </button>
                        <Link href={`/entry/edit?id=${id}`} className="px-4 py-2 rounded-xl bg-primary text-white hover:bg-primary/90 transition-all flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                            Edit
                        </Link>
                        <button onClick={handleDelete} className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
                        </button>
                    </div>
                </div>

                {/* Share URL Display */}
                {shareUrl && (
                    <div className="mb-6 p-4 rounded-xl bg-green-500/10 border border-green-500/30 flex items-center gap-3">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-400 shrink-0"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
                        <input type="text" readOnly value={shareUrl} className="flex-1 bg-transparent text-green-400 text-sm focus:outline-none" />
                        <button onClick={() => { navigator.clipboard.writeText(shareUrl); setIsCopied(true); setTimeout(() => setIsCopied(false), 2000); }} className="text-green-400 hover:text-green-300 text-sm font-medium">
                            {isCopied ? 'Copied!' : 'Copy'}
                        </button>
                    </div>
                )}

                {/* Cover Image */}
                {entry.coverImage && (
                    <div className="mb-8 rounded-2xl overflow-hidden">
                        <img src={entry.coverImage} alt={entry.title || 'Cover'} className="w-full h-64 md:h-80 object-cover" />
                    </div>
                )}

                {/* Audio Player */}
                {entry.audioUrl && (
                    <div className="mb-8 p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" x2="12" y1="19" y2="22" /></svg>
                        </div>
                        <div className="flex-1">
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Voice Note</p>
                            <audio controls src={entry.audioUrl} className="w-full h-8 opacity-80" />
                        </div>
                    </div>
                )}

                {/* Title & Meta */}
                <div className="mb-6">
                    <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">{entry.title || 'Untitled Entry'}</h1>
                    <p className="text-slate-500">
                        {new Date(entry.createdAt).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                </div>

                {/* Mood & Tags */}
                <div className="flex flex-wrap gap-2 mb-6">
                    {entry.mood && (
                        <span className="px-3 py-1 rounded-full bg-primary/20 text-primary text-sm capitalize">{entry.mood}</span>
                    )}
                    {entry.tags.map((tag) => (
                        <span key={tag} className="px-3 py-1 rounded-full bg-white/10 text-slate-300 text-sm">#{tag}</span>
                    ))}
                </div>

                {/* Content */}
                <div className="glass-card p-8 rounded-2xl">
                    {entry.contentHtml ? (
                        <div className="prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: entry.contentHtml }} />
                    ) : (
                        <p className="text-slate-300 whitespace-pre-wrap">{entry.content}</p>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function EntryDetailClient() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>}>
            <EntryDetailContent />
        </Suspense>
    );
}
