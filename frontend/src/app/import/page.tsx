'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

interface SocialPost {
    id: string;
    source: 'FACEBOOK' | 'INSTAGRAM';
    content: string;
    imageUrl: string;
    date: string;
}

export default function ImportPage() {
    const { accessToken, isLoading: authLoading } = useAuth();
    const [step, setStep] = useState<'connect' | 'select'>('connect');
    const [source, setSource] = useState<'FACEBOOK' | 'INSTAGRAM' | null>(null);
    const [feed, setFeed] = useState<SocialPost[]>([]);
    const [selectedPosts, setSelectedPosts] = useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const handleConnect = async (platform: 'FACEBOOK' | 'INSTAGRAM') => {
        setIsLoading(true);
        setSource(platform);
        setMessage(null);

        try {
            // Simulate OAuth connect & fetch feed
            const response = await fetch(`${API_URL}/social/${platform}`, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            const data = await response.json();

            if (response.ok) {
                setFeed(data.feed);
                setStep('select');
            } else {
                throw new Error(data.message);
            }
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message || 'Failed to connect' });
        } finally {
            setIsLoading(false);
        }
    };

    const toggleSelect = (postId: string) => {
        const newSelected = new Set(selectedPosts);
        if (newSelected.has(postId)) {
            newSelected.delete(postId);
        } else {
            newSelected.add(postId);
        }
        setSelectedPosts(newSelected);
    };

    const handleImport = async () => {
        setIsLoading(true);
        try {
            const postsToImport = feed.filter(p => selectedPosts.has(p.id));

            const response = await fetch(`${API_URL}/social/import`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify({ posts: postsToImport }),
            });

            const data = await response.json();

            if (response.ok) {
                setMessage({ type: 'success', text: data.message });
                setStep('connect');
                setFeed([]);
                setSelectedPosts(new Set());
            } else {
                throw new Error(data.message);
            }
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message || 'Import failed' });
        } finally {
            setIsLoading(false);
        }
    };

    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
        );
    }

    return (
        <div className="min-h-screen p-4 md:p-8 pb-24 md:pb-8">
            <div className="fixed top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[150px] pointer-events-none" />

            <div className="max-w-5xl mx-auto relative z-10">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <Link href="/dashboard" className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m12 19-7-7 7-7" /><path d="M19 12H5" />
                        </svg>
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold text-white">Import Memories</h1>
                        <p className="text-slate-400">Sync your social media timeline to Notive</p>
                    </div>
                </div>

                {/* Message */}
                {message && (
                    <div className={`mb-6 p-4 rounded-xl ${message.type === 'success' ? 'bg-green-500/10 border border-green-500/30 text-green-400' : 'bg-red-500/10 border border-red-500/30 text-red-400'}`}>
                        {message.text}
                    </div>
                )}

                {step === 'connect' ? (
                    <div className="grid md:grid-cols-2 gap-6">
                        {/* Facebook Connect */}
                        <div className="glass-card p-8 rounded-2xl flex flex-col items-center text-center hover:bg-white/5 transition-all">
                            <div className="w-16 h-16 rounded-full bg-[#1877F2]/20 flex items-center justify-center text-[#1877F2] mb-6">
                                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
                                </svg>
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-2">Facebook</h3>
                            <button
                                onClick={() => handleConnect('FACEBOOK')}
                                disabled={isLoading}
                                className="mt-4 px-8 py-3 rounded-xl bg-[#1877F2] text-white font-medium hover:bg-[#1877F2]/90 transition-all disabled:opacity-50"
                            >
                                {isLoading && source === 'FACEBOOK' ? 'Connecting...' : 'Connect Facebook'}
                            </button>
                        </div>

                        {/* Instagram Connect */}
                        <div className="glass-card p-8 rounded-2xl flex flex-col items-center text-center hover:bg-white/5 transition-all">
                            <div className="w-16 h-16 rounded-full bg-[#E4405F]/20 flex items-center justify-center text-[#E4405F] mb-6">
                                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
                                    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                                    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
                                </svg>
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-2">Instagram</h3>
                            <button
                                onClick={() => handleConnect('INSTAGRAM')}
                                disabled={isLoading}
                                className="mt-4 px-8 py-3 rounded-xl bg-gradient-to-r from-[#833AB4] via-[#FD1D1D] to-[#FCAF45] text-white font-medium hover:opacity-90 transition-all disabled:opacity-50"
                            >
                                {isLoading && source === 'INSTAGRAM' ? 'Connecting...' : 'Connect Instagram'}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div className="text-slate-300">
                                Found <span className="text-white font-bold">{feed.length}</span> memories from {source === 'FACEBOOK' ? 'Facebook' : 'Instagram'}
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setStep('connect')}
                                    className="px-4 py-2 rounded-lg text-slate-400 hover:text-white"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleImport}
                                    disabled={selectedPosts.size === 0 || isLoading}
                                    className="px-6 py-2 rounded-lg bg-primary text-white font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                >
                                    {isLoading ? 'Importing...' : `Import ${selectedPosts.size} Selected`}
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {feed.map((post) => (
                                <div
                                    key={post.id}
                                    onClick={() => toggleSelect(post.id)}
                                    className={`
                                        cursor-pointer group relative rounded-xl overflow-hidden border-2 transition-all duration-200
                                        ${selectedPosts.has(post.id) ? 'border-primary ring-2 ring-primary/20' : 'border-transparent hover:border-white/10'}
                                    `}
                                >
                                    <div className="aspect-square relative">
                                        <img src={post.imageUrl} alt="Post" className="w-full h-full object-cover" />
                                        <div className={`absolute inset-0 bg-black/40 transition-opacity flex items-center justify-center ${selectedPosts.has(post.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${selectedPosts.has(post.id) ? 'bg-primary text-white' : 'bg-white/20 text-white'}`}>
                                                {selectedPosts.has(post.id) && (
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                        <polyline points="20 6 9 17 4 12" />
                                                    </svg>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-slate-900/80 p-4">
                                        <p className="text-sm text-slate-300 line-clamp-2">{post.content}</p>
                                        <div className="mt-2 text-xs text-slate-500">
                                            {new Date(post.date).toLocaleDateString()}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
