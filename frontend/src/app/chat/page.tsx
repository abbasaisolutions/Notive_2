'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import useApi from '@/hooks/use-api';
import { API_URL } from '@/constants/config';
import useAuthRedirect from '@/hooks/use-auth-redirect';
import { NOTIVE_VOICE } from '@/content/notive-voice';
import useContextNavigation from '@/hooks/use-context-navigation';
import { ActionBar, AppPanel, EmptyState, SectionHeader, TagPill } from '@/components/ui/surface';
import { FiArrowLeft, FiArrowRight, FiCpu, FiSend } from 'react-icons/fi';

type GuidedLens = 'clarity' | 'memory' | 'growth' | 'patterns';

interface MessageMeta {
    mode?: 'guided_reflection' | 'llm' | 'hosted_fallback';
    model?: string;
    strategy?: 'hybrid' | 'recent' | 'starter';
    lens?: GuidedLens;
    prompts?: string[];
    highlights?: Array<{
        id: string;
        title: string | null;
        createdAt: string;
        mood: string | null;
        reason: string;
        excerpt: string;
    }>;
}

interface Message {
    role: 'user' | 'assistant';
    content: string;
    meta?: MessageMeta;
}

interface CoachStatus {
    available: boolean;
    provider: 'llm' | 'huggingface' | 'guided_reflection' | 'disabled';
    vendor: string;
    model?: string;
    message?: string;
    suggestions?: string[];
    lenses?: Array<{
        id: GuidedLens;
        label: string;
        description: string;
    }>;
    defaultLens?: GuidedLens;
}

export default function ChatPage() {
    const { isLoading: authLoading, isAuthenticated } = useAuthRedirect();
    const { apiFetch } = useApi();
    const { backLabel, navigateBack } = useContextNavigation('/dashboard', 'dashboard');
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [coachStatus, setCoachStatus] = useState<CoachStatus | null>(null);
    const [selectedLens, setSelectedLens] = useState<GuidedLens>('clarity');
    const [isStatusLoading, setIsStatusLoading] = useState(true);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        let mounted = true;

        const fetchCoachStatus = async () => {
            try {
                const response = await apiFetch(`${API_URL}/ai/status`);
                const data = await response.json().catch(() => null);
                if (!mounted || !data) return;
                setCoachStatus(data);
                if (data.provider === 'guided_reflection' && typeof data.defaultLens === 'string') {
                    setSelectedLens(data.defaultLens);
                }
            } catch (error) {
                console.error('Failed to fetch AI Coach status:', error);
                if (mounted) {
                    setCoachStatus({
                        available: false,
                        provider: 'disabled',
                        vendor: 'disabled',
                        message: 'AI Coach status could not be loaded for this environment.',
                    });
                }
            } finally {
                if (mounted) {
                    setIsStatusLoading(false);
                }
            }
        };

        fetchCoachStatus();

        return () => {
            mounted = false;
        };
    }, [apiFetch]);

    const handleSend = async () => {
        if (!input.trim() || isLoading || coachStatus?.available === false) return;

        const userMessage = input.trim();
        const isGuidedMode = coachStatus?.provider === 'guided_reflection';
        setInput('');
        setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
        setIsLoading(true);

        try {
            const response = await apiFetch(`${API_URL}/ai/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    query: userMessage,
                    lens: isGuidedMode ? selectedLens : undefined,
                }),
            });

            const data = await response.json().catch(() => null);
            if (!response.ok) {
                throw new Error(data?.message || data?.response || 'Failed to get response');
            }
            setMessages((prev) => [...prev, {
                role: 'assistant',
                content: data.response,
                meta: {
                    mode: data.mode,
                    model: data.model,
                    strategy: data.strategy,
                    lens: data.lens,
                    prompts: Array.isArray(data.prompts) ? data.prompts : [],
                    highlights: Array.isArray(data.highlights) ? data.highlights : [],
                },
            }]);
        } catch (error) {
            console.error('Chat error:', error);
            setMessages((prev) => [
                ...prev,
                {
                    role: 'assistant',
                    content: error instanceof Error ? error.message : 'Sorry, I encountered an error. Please try again.',
                },
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    if (authLoading || isStatusLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
        );
    }

    if (!isAuthenticated) {
        return null;
    }

    const coachAvailable = coachStatus?.available !== false;
    const coachMessage = coachStatus?.message || 'AI Coach is not enabled yet for this environment.';
    const coachMode = coachStatus?.provider === 'guided_reflection'
        ? 'guided'
        : coachAvailable
            ? 'live'
            : 'disabled';
    const suggestions = coachStatus?.suggestions || [
        'When was I last happy?',
        'What stressed me out recently?',
        'Summarize my week',
        'What are my recurring themes?',
    ];
    const guidedLenses = coachStatus?.lenses || [];
    const headerDescription = coachMode === 'guided'
        ? 'Use local reflection mode to surface relevant notes, patterns, and your next writing question.'
        : coachAvailable
            ? 'Ask Notive about your notes, your patterns, or what to write next.'
            : 'This environment is running without a live guide right now.';

    return (
        <div className="min-h-screen px-4 py-6 md:px-8 md:py-8">
            <div className="mx-auto max-w-5xl space-y-4">
                <AppPanel className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={navigateBack}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/[0.03] text-ink-secondary hover:text-white hover:bg-white/10 transition-colors"
                            aria-label={backLabel}
                            title={backLabel}
                        >
                            <FiArrowLeft size={20} aria-hidden="true" />
                        </button>
                        <SectionHeader
                            title={coachMode === 'guided' ? 'Guided Reflection' : NOTIVE_VOICE.surfaces.reflectionCoach}
                            description={headerDescription}
                            kicker={coachMode === 'guided' ? 'Reflect' : 'Guide'}
                            className="items-center"
                        />
                    </div>
                    <TagPill tone={coachAvailable ? 'primary' : 'muted'} className="gap-1">
                        <FiCpu size={12} aria-hidden="true" />
                        {coachMode === 'guided' ? 'Guided Reflection' : coachAvailable ? 'Context Aware' : 'Unavailable'}
                    </TagPill>
                </AppPanel>

                <AppPanel className="min-h-[60vh]">
                    <div className="space-y-4">
                        {coachMode === 'guided' && (
                            <div className="space-y-3 rounded-2xl border border-primary/20 bg-primary/10 px-4 py-4 text-sm text-white/85">
                                <p className="font-medium text-white">This space is running in guided reflection mode.</p>
                                <p>{coachMessage}</p>
                                <p>It stays grounded in your own notes, related entries, and fixed reflection prompts instead of open-ended generation.</p>
                                {guidedLenses.length > 0 && (
                                    <div className="grid gap-2 md:grid-cols-4">
                                        {guidedLenses.map((lens) => {
                                            const active = selectedLens === lens.id;
                                            return (
                                                <button
                                                    key={lens.id}
                                                    type="button"
                                                    onClick={() => setSelectedLens(lens.id)}
                                                    className={`rounded-2xl border px-3 py-3 text-left transition-colors ${
                                                        active
                                                            ? 'border-primary/35 bg-primary/15 text-white'
                                                            : 'border-white/12 bg-white/[0.03] text-white/80 hover:bg-white/[0.06]'
                                                    }`}
                                                >
                                                    <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">{lens.label}</p>
                                                    <p className="mt-1 text-xs leading-5">{lens.description}</p>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        {!coachAvailable && (
                            <div className="rounded-2xl border border-white/12 bg-white/[0.03] px-4 py-4 text-sm text-ink-secondary">
                                <p className="font-medium text-white">Guide is paused here.</p>
                                <p className="mt-2">{coachMessage}</p>
                                <p className="mt-2">You can still use {NOTIVE_VOICE.surfaces.memoryAtlas}, {NOTIVE_VOICE.surfaces.signalStudio}, and {NOTIVE_VOICE.surfaces.outcomeStudio} while we finish the provider setup.</p>
                            </div>
                        )}

                        {messages.length === 0 ? (
                            <EmptyState
                                title={coachMode === 'guided' ? 'Pick a lens and begin' : 'Ask Notive anything'}
                                description={coachAvailable ? 'Use one of the reflection starters below or type your own question.' : 'Come back when a guide provider is enabled to use chat.'}
                                className="py-12"
                            />
                        ) : (
                            messages.map((message, index) => (
                                <div
                                    key={index}
                                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div
                                        className={`max-w-[84%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                                            message.role === 'user'
                                                ? 'rounded-br-sm border border-primary/30 bg-primary/15 text-white'
                                                : 'rounded-bl-sm border border-white/12 bg-white/[0.04] text-ink-secondary'
                                        }`}
                                    >
                                        <p className="whitespace-pre-wrap">{message.content}</p>

                                        {message.role === 'assistant' && message.meta?.mode === 'guided_reflection' && (
                                            <div className="mt-3 space-y-3">
                                                <div className="flex flex-wrap gap-2">
                                                    {message.meta.lens && <TagPill tone="primary">{message.meta.lens}</TagPill>}
                                                    {message.meta.strategy && <TagPill>{message.meta.strategy}</TagPill>}
                                                </div>

                                                {message.meta.highlights && message.meta.highlights.length > 0 && (
                                                    <div className="grid gap-2 md:grid-cols-2">
                                                        {message.meta.highlights.map((highlight) => (
                                                            <Link
                                                                key={`${index}-${highlight.id}`}
                                                                href={`/entry/view?id=${highlight.id}`}
                                                                className="rounded-xl border border-white/10 bg-black/20 px-3 py-3 transition-colors hover:border-white/15 hover:bg-black/30"
                                                            >
                                                                <div className="flex items-start justify-between gap-2">
                                                                    <div>
                                                                        <p className="text-[11px] uppercase tracking-[0.12em] text-ink-muted">{highlight.createdAt}</p>
                                                                        <p className="mt-1 text-sm font-semibold text-white">{highlight.title || 'Untitled note'}</p>
                                                                    </div>
                                                                    <FiArrowRight size={14} className="text-ink-muted" aria-hidden="true" />
                                                                </div>
                                                                <p className="mt-2 text-xs leading-6 text-ink-secondary">{highlight.excerpt}</p>
                                                                <div className="mt-2 flex flex-wrap gap-2">
                                                                    {highlight.mood && <TagPill tone="primary">{highlight.mood}</TagPill>}
                                                                    <TagPill>{highlight.reason}</TagPill>
                                                                </div>
                                                            </Link>
                                                        ))}
                                                    </div>
                                                )}

                                                {message.meta.prompts && message.meta.prompts.length > 0 && (
                                                    <div className="flex flex-wrap gap-2">
                                                        {message.meta.prompts.map((prompt) => (
                                                            <button
                                                                key={`${index}-${prompt}`}
                                                                type="button"
                                                                onClick={() => setInput(prompt)}
                                                                className="rounded-full border border-white/12 bg-white/[0.03] px-3 py-1.5 text-xs text-ink-secondary hover:text-white hover:bg-white/10 transition-colors"
                                                            >
                                                                {prompt}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}

                        {isLoading && (
                            <div className="flex justify-start">
                                <div className="rounded-2xl rounded-bl-sm border border-white/12 bg-white/[0.04] px-4 py-3">
                                    <div className="flex gap-1">
                                        <span className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
                                        <span className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
                                        <span className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
                                    </div>
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>
                </AppPanel>

                <ActionBar className="justify-between">
                    <div className="space-y-2">
                        <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">
                            {coachMode === 'guided' ? 'Reflection starters' : 'Suggestions'}
                        </p>
                        <div className="flex flex-wrap gap-2">
                        {coachAvailable && suggestions.map((suggestion) => (
                            <button
                                key={suggestion}
                                type="button"
                                onClick={() => setInput(suggestion)}
                                className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                                    coachMode === 'guided'
                                        ? 'border-primary/20 bg-primary/10 text-white hover:bg-primary/16'
                                        : 'border-white/15 bg-white/[0.03] text-ink-secondary hover:text-white hover:bg-white/10'
                                }`}
                            >
                                {suggestion}
                            </button>
                        ))}
                        </div>
                    </div>
                </ActionBar>

                <AppPanel className="p-3">
                    <div className="flex gap-3">
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={
                                coachMode === 'guided'
                                    ? 'Describe what you want to reflect on, or choose a starter above...'
                                    : coachAvailable
                                        ? 'Ask about a note, a feeling, a topic, or what to write next...'
                                        : 'Guide is unavailable in this environment.'
                            }
                            rows={1}
                            disabled={!coachAvailable}
                            className="flex-1 rounded-xl border border-white/12 bg-white/[0.03] px-4 py-3 text-sm text-white placeholder-ink-muted focus:outline-none focus:ring-2 focus:ring-primary/35 resize-none"
                        />
                        <button
                            onClick={handleSend}
                            disabled={isLoading || !input.trim() || !coachAvailable}
                            className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/15 px-5 py-3 text-sm font-semibold text-white hover:bg-primary/25 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <FiSend size={16} aria-hidden="true" />
                            {coachMode === 'guided' ? 'Continue' : coachAvailable ? 'Send' : 'Unavailable'}
                        </button>
                    </div>
                </AppPanel>
            </div>
        </div>
    );
}
