'use client';

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { API_URL } from '@/constants/config';
import { sanitizeHtml } from '@/utils/sanitize-html';
import { AppPanel, TagPill } from '@/components/ui/surface';

interface SharedUser {
    name?: string | null;
}

interface SharedEntryContent {
    user?: SharedUser;
    createdAt: string;
    title?: string | null;
    mood?: string | null;
    tags?: string[];
    coverImage?: string | null;
    contentHtml?: string | null;
    content?: string;
}

interface SharedContent {
    type: 'entry' | 'chapter';
    content: SharedEntryContent;
}

function SharedPageContent() {
    const searchParams = useSearchParams();
    const token = searchParams.get('token');
    const [data, setData] = useState<SharedContent | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!token) {
            setError('Invalid link.');
            setIsLoading(false);
            return;
        }

        const controller = new AbortController();

        const fetchSharedContent = async () => {
            try {
                const response = await fetch(`${API_URL}/share/${token}`, {
                    signal: controller.signal,
                });

                if (response.ok) {
                    const result = await response.json();
                    setData(result);
                } else {
                    setError('This link is invalid or has expired.');
                }
            } catch (err) {
                if (controller.signal.aborted) return;
                setError('Failed to load shared content.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchSharedContent();

        return () => {
            controller.abort();
        };
    }, [token]);

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center">
                <h1 className="text-2xl font-bold text-white mb-2">Oops!</h1>
                <p className="text-ink-secondary mb-6">{error || 'Content not found'}</p>
                <Link href="/" className="px-6 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-all">
                    Go to Notive
                </Link>
            </div>
        );
    }

    const { content } = data;

    return (
        <div className="min-h-screen text-ink-secondary selection:bg-primary/30">
            {/* Top Bar with Branding */}
            <div className="border-b border-white/10 bg-surface-1/80 backdrop-blur-md sticky top-0 z-50">
                <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                            Notive.
                        </h1>
                        <TagPill tone="muted">Shared Memory</TagPill>
                    </div>

                    <Link href="/register" className="text-sm font-medium text-white hover:text-primary transition-colors">
                        Build your own story system →
                    </Link>
                </div>
            </div>

            <main className="max-w-3xl mx-auto px-6 py-12 relative">
                {/* Background Glow */}
                <div className="fixed top-20 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-primary/20 blur-[120px] rounded-full pointer-events-none" />

                <AppPanel className="relative z-10 p-8 md:p-12 rounded-2xl border border-white/10 shadow-2xl">
                    {/* User Info */}
                    <div className="flex items-center gap-3 mb-8 pb-8 border-b border-white/5">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-lg font-bold text-white shadow-lg">
                            {content.user?.name?.charAt(0) || 'U'}
                        </div>
                        <div>
                            <div className="text-white font-medium">{content.user?.name || 'Anonymous User'}</div>
                            <div className="text-sm text-ink-secondary">
                                shared a memory from {new Date(content.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                            </div>
                        </div>
                    </div>

                    {/* Entry Content */}
                    <article className="prose prose-invert prose-lg max-w-none">
                        <h1 className="mb-4 text-3xl md:text-4xl font-bold text-white leading-tight">
                            {content.title || 'Untitled Entry'}
                        </h1>

                        <div className="flex flex-wrap gap-2 mb-8 not-prose">
                            {content.mood && (
                                <span className="px-3 py-1 rounded-full border border-primary/30 bg-primary/15 text-primary text-sm font-medium">
                                    {content.mood}
                                </span>
                            )}
                            {content.tags?.map((tag: string) => (
                                <span key={tag} className="px-3 py-1 rounded-full border border-white/12 bg-white/[0.03] text-ink-secondary text-sm">
                                    #{tag}
                                </span>
                            ))}
                        </div>

                        {content.coverImage && (
                            <img src={content.coverImage} alt="Cover" className="w-full rounded-xl mb-8 border border-white/5 shadow-lg" />
                        )}

                        {content.contentHtml ? (
                            <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(content.contentHtml) }} />
                        ) : (
                            <div className="whitespace-pre-wrap text-ink-secondary leading-relaxed">
                                {content.content}
                            </div>
                        )}
                    </article>
                </AppPanel>

                <div className="mt-12 text-center text-ink-muted text-sm">
                    Powered by <span className="text-primary font-semibold">Notive</span> - Memory, signal, and story for personal growth
                </div>
            </main>
        </div>
    );
}

export default function SharedPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>}>
            <SharedPageContent />
        </Suspense>
    );
}
