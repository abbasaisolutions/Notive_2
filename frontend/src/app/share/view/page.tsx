'use client';

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
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
            <div className="min-h-screen flex items-center justify-center bg-teal-dark">
                <div className="animate-spin h-8 w-8 border-4 border-secondary border-t-transparent rounded-full" />
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-teal-dark p-4 text-center">
                <h1 className="text-2xl font-bold text-cream mb-2">Oops!</h1>
                <p className="text-cream/60 mb-6">{error || 'Content not found'}</p>
                <Link href="/" className="px-6 py-2 bg-primary text-cream rounded-xl hover:bg-primary/90 transition-all">
                    Go to Notive
                </Link>
            </div>
        );
    }

    const { content } = data;

    return (
        <div className="min-h-screen bg-teal-dark text-cream selection:bg-secondary/30">
            {/* Top Bar with Branding */}
            <div className="border-b border-cream/5 bg-teal-dark/50 backdrop-blur-md sticky top-0 z-50">
                <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Image
                            src="/logos/icon.png"
                            alt="Notive"
                            width={32}
                            height={32}
                        />
                        <h1 className="text-xl font-bold bg-gradient-to-r from-secondary to-cream bg-clip-text text-transparent">
                            Notive.
                        </h1>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-cream/10 text-cream/60">Shared Memory</span>
                    </div>

                    <Link href="/register" className="text-sm font-medium text-cream hover:text-secondary transition-colors">
                        Create your own journal →
                    </Link>
                </div>
            </div>

            <main className="max-w-3xl mx-auto px-6 py-12 relative">
                {/* Background Glow */}
                <div className="fixed top-20 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-secondary/20 blur-[120px] rounded-full pointer-events-none" />

                <div className="relative z-10 glass-card p-8 md:p-12 rounded-2xl border border-cream/10 shadow-2xl">
                    {/* User Info */}
                    <div className="flex items-center gap-3 mb-8 pb-8 border-b border-cream/5">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-lg font-bold text-cream shadow-lg">
                            {content.user?.name?.charAt(0) || 'U'}
                        </div>
                        <div>
                            <div className="text-cream font-medium">{content.user?.name || 'Anonymous User'}</div>
                            <div className="text-sm text-cream/60">
                                shared a memory from {new Date(content.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                            </div>
                        </div>
                    </div>

                    {/* Entry Content */}
                    <article className="prose prose-invert prose-lg max-w-none">
                        <h1 className="mb-4 text-3xl md:text-4xl font-bold text-cream leading-tight">
                            {content.title || 'Untitled Entry'}
                        </h1>

                        <div className="flex flex-wrap gap-2 mb-8 not-prose">
                            {content.mood && (
                                <span className="px-3 py-1 rounded-full bg-secondary/20 text-secondary text-sm font-medium">
                                    {content.mood}
                                </span>
                            )}
                            {content.tags?.map((tag: string) => (
                                <span key={tag} className="px-3 py-1 rounded-full bg-primary/20 text-cream/80 text-sm border border-cream/5">
                                    #{tag}
                                </span>
                            ))}
                        </div>

                        {content.coverImage && (
                            <img src={content.coverImage} alt="Cover" className="w-full rounded-xl mb-8 border border-cream/5 shadow-lg" />
                        )}

                        {content.contentHtml ? (
                            <div dangerouslySetInnerHTML={{ __html: content.contentHtml }} />
                        ) : (
                            <div className="whitespace-pre-wrap text-cream/80 leading-relaxed">
                                {content.content}
                            </div>
                        )}
                    </article>
                </div>

                <div className="mt-12 text-center text-cream/50 text-sm">
                    Powered by <span className="text-secondary font-semibold">Notive</span> - The Intelligent Journal for Personal Growth
                </div>
            </main>
        </div>
    );
}

export default function SharedPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-teal-dark"><div className="animate-spin h-8 w-8 border-4 border-secondary border-t-transparent rounded-full" /></div>}>
            <SharedPageContent />
        </Suspense>
    );
}
