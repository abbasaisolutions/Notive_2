'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { getChapterIcon } from '@/constants/chapter-icons';
import { PenLine } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

interface Chapter {
    id: string;
    name: string;
    description: string | null;
    color: string;
    icon: string;
}

interface Entry {
    id: string;
    title: string | null;
    content: string;
    mood: string | null;
    tags: string[];
    coverImage: string | null;
    createdAt: string;
}

function ChapterDetailContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const id = searchParams.get('id');
    const { user, accessToken, isLoading: authLoading } = useAuth();
    const [chapter, setChapter] = useState<Chapter | null>(null);
    const [entries, setEntries] = useState<Entry[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!id) {
            router.push('/chapters');
            return;
        }

        const fetchChapterEntries = async () => {
            if (!accessToken) return;

            try {
                const response = await fetch(`${API_URL}/chapters/${id}/entries`, {
                    headers: { Authorization: `Bearer ${accessToken}` },
                });

                if (response.ok) {
                    const data = await response.json();
                    setChapter(data.chapter);
                    setEntries(data.entries);
                } else {
                    router.push('/chapters');
                }
            } catch (error) {
                console.error('Failed to fetch chapter:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchChapterEntries();
    }, [accessToken, id, router]);

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

    if (!chapter) {
        return null;
    }

    return (
        <div className="min-h-screen p-4 md:p-8">
            {/* Background Glow */}
            <div className="fixed top-0 left-1/4 w-96 h-96 rounded-full blur-[150px] pointer-events-none" style={{ backgroundColor: `${chapter.color}20` }} />

            <div className="max-w-6xl mx-auto relative z-10">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <Link href="/chapters" className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m12 19-7-7 7-7" /><path d="M19 12H5" />
                        </svg>
                    </Link>
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: `${chapter.color}20` }}>
                            {(() => {
                                const ChapterIcon = getChapterIcon(chapter.icon);
                                return <ChapterIcon className="w-7 h-7 text-white" />;
                            })()}
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-white">{chapter.name}</h1>
                            {chapter.description && <p className="text-slate-400">{chapter.description}</p>}
                        </div>
                    </div>
                </div>

                {/* Entries */}
                {entries.length === 0 ? (
                    <div className="glass-card p-12 rounded-2xl text-center">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/10 flex items-center justify-center">
                            <PenLine className="w-8 h-8 text-white" />
                        </div>
                        <h3 className="text-xl font-semibold text-white mb-2">No Entries Yet</h3>
                        <p className="text-slate-400 mb-6">Add entries to this chapter from the entry editor.</p>
                        <Link href="/entry/new" className="bg-primary hover:bg-primary/90 text-white px-6 py-3 rounded-xl font-medium transition-all inline-block">
                            Create Entry
                        </Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {entries.map((entry) => (
                            <Link key={entry.id} href={`/entry/view?id=${entry.id}`} className="glass-card rounded-2xl hover:bg-white/5 transition-all group overflow-hidden flex flex-col h-full">
                                {entry.coverImage && (
                                    <div className="h-48 w-full overflow-hidden">
                                        <img src={entry.coverImage} alt={entry.title || 'Entry'} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                    </div>
                                )}
                                <div className="p-6 flex-1 flex flex-col">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="text-sm text-slate-400">
                                            {new Date(entry.createdAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                                        </div>
                                        {entry.mood && <span className="px-2 py-1 rounded-lg bg-white/10 text-xs text-slate-300 capitalize">{entry.mood}</span>}
                                    </div>
                                    <h4 className="text-lg font-bold text-white mb-2 group-hover:text-primary transition-colors line-clamp-1">
                                        {entry.title || 'Untitled Entry'}
                                    </h4>
                                    <p className="text-slate-400 text-sm line-clamp-3 mb-4 flex-1">{entry.content}</p>
                                    <div className="flex flex-wrap gap-2">
                                        {entry.tags.map((tag) => (
                                            <span key={tag} className="text-xs text-primary bg-primary/10 px-2 py-1 rounded-md">#{tag}</span>
                                        ))}
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default function ChapterDetailPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>}>
            <ChapterDetailContent />
        </Suspense>
    );
}
