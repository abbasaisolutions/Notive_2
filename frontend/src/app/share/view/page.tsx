'use client';

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

interface SharedContent {
    type: 'entry' | 'chapter';
    content: any;
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

        const fetchSharedContent = async () => {
            try {
                const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'}/share/${token}`);

                if (response.ok) {
                    const result = await response.json();
                    setData(result);
                } else {
                    setError('This link is invalid or has expired.');
                }
            } catch (err) {
                setError('Failed to load shared content.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchSharedContent();
    }, [token]);

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-950">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 p-4 text-center">
                <h1 className="text-2xl font-bold text-white mb-2">Oops!</h1>
                <p className="text-slate-400 mb-6">{error || 'Content not found'}</p>
                <Link href="/" className="px-6 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-all">
                    Go to Notive
                </Link>
            </div>
        );
    }

    const { content } = data;

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 selection:bg-primary/30">
            {/* Top Bar with Branding */}
            <div className="border-b border-white/5 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
                <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">
                            Notive.
                        </h1>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-slate-400">Shared Memory</span>
                    </div>

                    <Link href="/register" className="text-sm font-medium text-white hover:text-primary transition-colors">
                        Create your own journal →
                    </Link>
                </div>
            </div>

            <main className="max-w-3xl mx-auto px-6 py-12 relative">
                {/* Background Glow */}
                <div className="fixed top-20 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-primary/20 blur-[120px] rounded-full pointer-events-none" />

                <div className="relative z-10 glass-card p-8 md:p-12 rounded-2xl border border-white/10 shadow-2xl">
                    {/* User Info */}
                    <div className="flex items-center gap-3 mb-8 pb-8 border-b border-white/5">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-lg font-bold text-white shadow-lg">
                            {content.user?.name?.charAt(0) || 'U'}
                        </div>
                        <div>
                            <div className="text-white font-medium">{content.user?.name || 'Anonymous User'}</div>
                            <div className="text-sm text-slate-400">
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
                                <span className="px-3 py-1 rounded-full bg-primary/20 text-primary text-sm font-medium">
                                    {content.mood}
                                </span>
                            )}
                            {content.tags?.map((tag: string) => (
                                <span key={tag} className="px-3 py-1 rounded-full bg-slate-800 text-slate-300 text-sm border border-white/5">
                                    #{tag}
                                </span>
                            ))}
                        </div>

                        {content.coverImage && (
                            <img src={content.coverImage} alt="Cover" className="w-full rounded-xl mb-8 border border-white/5 shadow-lg" />
                        )}

                        {content.contentHtml ? (
                            <div dangerouslySetInnerHTML={{ __html: content.contentHtml }} />
                        ) : (
                            <div className="whitespace-pre-wrap text-slate-300 leading-relaxed">
                                {content.content}
                            </div>
                        )}
                    </article>
                </div>

                <div className="mt-12 text-center text-slate-500 text-sm">
                    Powered by <span className="text-primary font-semibold">Notive</span> - The Intelligent Journal for Personal Growth
                </div>
            </main>
        </div>
    );
}

export default function SharedPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-slate-950"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>}>
            <SharedPageContent />
        </Suspense>
    );
}
