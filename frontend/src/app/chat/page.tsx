'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import useApi from '@/hooks/use-api';
import { API_URL } from '@/constants/config';
import useAuthRedirect from '@/hooks/use-auth-redirect';
import useContextNavigation from '@/hooks/use-context-navigation';
import { ActionBar, AppPanel, EmptyState, TagPill } from '@/components/ui/surface';
import { FiArrowLeft, FiArrowRight, FiChevronDown, FiSend } from 'react-icons/fi';
import ActionBriefPanel from '@/components/action/ActionBriefPanel';
import BridgeCard from '@/components/action/BridgeCard';
import SafetyBanner from '@/components/safety/SafetyBanner';
import type { StudentActionBrief, StudentBridgeDraft, StudentRisk, StudentSafetyCard } from '@/components/action/types';
import useTelemetry from '@/hooks/use-telemetry';
import { Spinner } from '@/components/ui';
import UserAvatar from '@/components/ui/UserAvatar';
import { NotebookDoodle } from '@/components/dashboard/NotebookDoodles';
import { NOTIVE_VOICE, type NotiveChatLens } from '@/content/notive-voice';

type GuidedLens = NotiveChatLens | 'clarity' | 'growth' | 'bridge';

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
    brief?: StudentActionBrief | null;
    bridge?: StudentBridgeDraft | null;
    risk?: StudentRisk;
    safetyCard?: StudentSafetyCard | null;
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
    const { user, isLoading: authLoading, isAuthenticated } = useAuthRedirect();
    const { apiFetch } = useApi();
    const { trackEvent } = useTelemetry();
    const { backLabel, navigateBack } = useContextNavigation('/dashboard', 'dashboard');
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [coachStatus, setCoachStatus] = useState<CoachStatus | null>(null);
    const [selectedLens, setSelectedLens] = useState<GuidedLens>('stories');
    const [requestedLens, setRequestedLens] = useState<GuidedLens | null>(null);
    const [isStatusLoading, setIsStatusLoading] = useState(true);
    const [showLensPicker, setShowLensPicker] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const lens = new URLSearchParams(window.location.search).get('lens');
        if (
            lens === 'clarity'
            || lens === 'memory'
            || lens === 'growth'
            || lens === 'patterns'
            || lens === 'bridge'
            || lens === 'lessons'
            || lens === 'stories'
        ) {
            setRequestedLens(lens);
        }
    }, []);

    useEffect(() => {
        let mounted = true;

        const fetchCoachStatus = async () => {
            try {
                const response = await apiFetch(`/ai/status`);
                const data = await response.json().catch(() => null);
                if (!mounted || !data) return;
                setCoachStatus(data);
                if (data.provider === 'guided_reflection') {
                    if (requestedLens) {
                        setSelectedLens(requestedLens);
                    } else if (typeof data.defaultLens === 'string') {
                        setSelectedLens(data.defaultLens);
                    }
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
    }, [apiFetch, requestedLens]);

    useEffect(() => {
        if (requestedLens) {
            setSelectedLens(requestedLens);
        }
    }, [requestedLens]);

    const handleSend = async () => {
        if (!input.trim() || isLoading || coachStatus?.available === false) return;

        const userMessage = input.trim();
        const isGuidedMode = coachStatus?.provider === 'guided_reflection';
        setInput('');
        setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
        setIsLoading(true);

        try {
            const response = await apiFetch(`/ai/chat`, {
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
                throw new Error(data?.message || data?.response || 'Couldn\u2019t get a response. Try again?');
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
                    brief: data.brief || null,
                    bridge: data.bridge || null,
                    risk: data.risk || undefined,
                    safetyCard: data.safetyCard || null,
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
                <Spinner size="md" />
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
    const suggestions = coachStatus?.suggestions || NOTIVE_VOICE.chat.suggestions;
    const guidedLenses = coachStatus?.lenses || [];
    const lensLabelMap = new Map(guidedLenses.map((lens) => [lens.id, lens.label]));
    const selectedLensLabel = lensLabelMap.get(selectedLens) || selectedLens;
    const activeGuidedLens = guidedLenses.find((lens) => lens.id === selectedLens) || null;

    const handleLensSelection = (lensId: GuidedLens) => {
        setSelectedLens(lensId);
        setShowLensPicker(false);
        void trackEvent({
            eventType: 'guide_lens_selected',
            value: lensId,
            metadata: {
                mode: coachMode,
            },
        });
    };

    const handleStarterSelection = (prompt: string, surface: 'starter_deck' | 'suggestion_chip' | 'follow_up_prompt') => {
        setInput(prompt);
        void trackEvent({
            eventType: 'guide_starter_selected',
            value: prompt.slice(0, 140),
            metadata: {
                surface,
                mode: coachMode,
                lens: selectedLens,
            },
        });
    };

    const handleBridgeCopy = (recipient: string, surface: 'guide_card') => {
        void trackEvent({
            eventType: 'student_bridge_copied',
            field: 'recipient',
            value: recipient,
            metadata: {
                surface,
                mode: coachMode,
                lens: selectedLens,
            },
        });
    };

    const renderMessageMeta = (message: Message, index: number) => {
        if (message.role !== 'assistant' || !message.meta) return null;

        const hasHighlights = !!message.meta.highlights?.length;
        const hasPrompts = !!message.meta.prompts?.length;
        const hasActionable = !!message.meta.brief || !!message.meta.bridge || !!message.meta.risk;
        if (!hasHighlights && !hasPrompts && !hasActionable) return null;

        const isBridgeMode = message.meta.lens === 'bridge';
        const hasElevatedRisk = message.meta.risk?.level === 'orange' || message.meta.risk?.level === 'red';
        const showSupportPanels = isBridgeMode || hasElevatedRisk;

        return (
            <div className="mt-3 space-y-3">
                {message.meta.risk && (
                    <SafetyBanner
                        risk={message.meta.risk}
                        safetyCard={message.meta.safetyCard || null}
                        surface="guide"
                        compact={message.meta.risk.level === 'yellow'}
                    />
                )}

                {showSupportPanels && message.meta.bridge && (
                    <BridgeCard
                        bridge={message.meta.bridge}
                        surface="guide"
                        openEntryHref={(entryId) => `/entry/view?id=${entryId}`}
                        onCopyDraft={() => handleBridgeCopy(message.meta?.bridge?.recommendedRecipient || 'trusted contact', 'guide_card')}
                        variant="notebook"
                    />
                )}

                {showSupportPanels && message.meta.brief && (
                    <ActionBriefPanel
                        brief={message.meta.brief}
                        surface="guide"
                        openEntryHref={(entryId) => `/entry/view?id=${entryId}`}
                    />
                )}


                {hasHighlights && (
                    <div className="grid gap-2 md:grid-cols-2">
                        {message.meta.highlights?.map((highlight) => (
                            <Link
                                key={`${index}-${highlight.id}`}
                                href={`/entry/view?id=${highlight.id}`}
                                className="workspace-soft-panel rounded-xl px-3 py-3 transition-colors hover:brightness-[1.02]"
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">{highlight.createdAt}</p>
                                        <p className="mt-1 text-sm font-semibold workspace-heading">{highlight.title || 'Untitled note'}</p>
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

                {hasPrompts && (
                    <div className="flex flex-wrap gap-2">
                        {message.meta.prompts?.map((prompt) => (
                            <button
                                key={`${index}-${prompt}`}
                                type="button"
                                onClick={() => handleStarterSelection(prompt, 'follow_up_prompt')}
                                className="workspace-pill rounded-full px-3 py-1.5 text-xs transition-colors hover:brightness-[1.1]"
                            >
                                {prompt}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="page-paper-canvas min-h-screen px-4 py-6 md:px-8 md:py-8">
            <div className="mx-auto max-w-5xl space-y-4">
                <AppPanel className="flex items-center justify-between gap-3" doodle="sprout" doodleAccent="sage">
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={navigateBack}
                            className="workspace-button-ghost inline-flex h-10 w-10 items-center justify-center rounded-xl transition-colors"
                            aria-label={backLabel}
                            title={backLabel}
                        >
                            <FiArrowLeft size={20} aria-hidden="true" />
                        </button>
                        <div>
                            <h1 className="text-lg font-semibold workspace-heading">AskNotive</h1>
                            <p className="text-xs text-ink-muted">
                                {coachAvailable ? NOTIVE_VOICE.chat.subtitle : 'Unavailable in this environment'}
                            </p>
                        </div>
                    </div>
                </AppPanel>

                {coachMode === 'guided' && guidedLenses.length > 0 && (
                    <AppPanel className="space-y-3">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div className="min-w-0">
                                <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Reflection lens</p>
                                <h2 className="workspace-heading mt-2 text-lg font-semibold">{selectedLensLabel}</h2>
                                <p className="mt-1 text-sm leading-7 text-ink-secondary">
                                    {activeGuidedLens?.description || 'Choose the lens that best matches what you want to understand or reuse from your notes.'}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowLensPicker((current) => !current)}
                                aria-expanded={showLensPicker}
                                className="workspace-button-outline inline-flex shrink-0 items-center justify-center gap-2 rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em]"
                            >
                                Switch lens
                                <FiChevronDown
                                    size={14}
                                    aria-hidden="true"
                                    className={`transition-transform ${showLensPicker ? 'rotate-180' : ''}`}
                                />
                            </button>
                        </div>
                        <div className={`flex flex-wrap gap-2 ${showLensPicker ? '' : 'hidden'}`}>
                            {guidedLenses.map((lens) => {
                                const active = selectedLens === lens.id;
                                return (
                                    <button
                                        key={lens.id}
                                        type="button"
                                        aria-pressed={active}
                                        onClick={() => handleLensSelection(lens.id)}
                                        className={`rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] transition-colors ${
                                            active
                                                ? 'border-primary/35 bg-primary/15 text-primary'
                                                : 'workspace-button-outline text-ink-secondary'
                                        }`}
                                        title={lens.description}
                                    >
                                        {lens.label}
                                    </button>
                                );
                            })}
                        </div>
                    </AppPanel>
                )}

                <AppPanel className="min-h-[60vh]">
                    <div className="space-y-4" aria-live="polite" aria-atomic="false" aria-label="Conversation">
                        {!coachAvailable && (
                            <div className="workspace-soft-panel rounded-2xl px-4 py-4 text-sm">
                                <p className="font-medium workspace-heading">AskNotive is paused here.</p>
                                <p className="mt-2 text-[rgb(var(--text-secondary))]">{coachMessage}</p>
                                <p className="mt-2 text-[rgb(var(--text-secondary))]">You can still write entries, browse memories, and check patterns.</p>
                            </div>
                        )}

                        {messages.length === 0 ? (
                            <div className="space-y-4 py-6">
                                <EmptyState
                                    doodle="compass"
                                    doodleAccent="sky"
                                    title="Ask anything about your notes"
                                    description={coachAvailable
                                        ? 'Start with a question, or write one fresh memory first so Notive has more to work with.'
                                        : 'Come back when the guide is available.'}
                                    actionLabel={coachAvailable ? 'Write memory' : undefined}
                                    actionHref={coachAvailable ? '/entry/new?mode=quick' : undefined}
                                    className="py-8"
                                />

                                {coachAvailable && (
                                    <div className="grid gap-3 md:grid-cols-2">
                                        {suggestions.slice(0, 2).map((suggestion) => (
                                            <button
                                                key={suggestion}
                                                type="button"
                                                onClick={() => handleStarterSelection(suggestion, 'starter_deck')}
                                                className="workspace-soft-panel rounded-[1.4rem] p-5 text-left transition-colors hover:brightness-[1.04]"
                                            >
                                                <p className="text-base font-semibold leading-7 workspace-heading">{suggestion}</p>
                                                <FiArrowRight size={14} className="mt-3 text-[rgb(var(--text-muted))]" aria-hidden="true" />
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : (
                            messages.map((message, index) => (
                                <div
                                    key={index}
                                    className={`flex items-end gap-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                >
                                    {message.role === 'assistant' && (
                                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[rgba(var(--paper-warm),0.6)] ring-1 ring-[rgba(var(--paper-border),0.2)]">
                                            <NotebookDoodle name="sprout" accent="sage" size={16} />
                                        </div>
                                    )}
                                    <div
                                        className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                                            message.role === 'user'
                                                ? 'rounded-br-sm workspace-button-primary'
                                                : 'rounded-bl-sm workspace-soft-panel text-[rgb(var(--text-secondary))]'
                                        }`}
                                    >
                                        <p className="whitespace-pre-wrap">{message.content}</p>

                                        {renderMessageMeta(message, index)}
                                    </div>
                                    {message.role === 'user' && (
                                        <UserAvatar
                                            avatarUrl={user?.avatarUrl}
                                            name={user?.name}
                                            size={28}
                                        />
                                    )}
                                </div>
                            ))
                        )}

                        {isLoading && (
                            <div className="flex items-end gap-2 justify-start">
                                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[rgba(var(--paper-warm),0.6)] ring-1 ring-[rgba(var(--paper-border),0.2)]">
                                    <NotebookDoodle name="sprout" accent="sage" size={16} />
                                </div>
                                <div className="workspace-soft-panel rounded-2xl rounded-bl-sm px-4 py-3">
                                    <div className="flex gap-1">
                                        <span className="h-2 w-2 rounded-full bg-[rgb(var(--brand))] animate-bounce" style={{ animationDelay: '0ms' }} />
                                        <span className="h-2 w-2 rounded-full bg-[rgb(var(--brand))] animate-bounce" style={{ animationDelay: '150ms' }} />
                                        <span className="h-2 w-2 rounded-full bg-[rgb(var(--brand))] animate-bounce" style={{ animationDelay: '300ms' }} />
                                    </div>
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>
                </AppPanel>

                {coachAvailable && messages.length > 0 && (
                    <ActionBar>
                        <div className="flex flex-wrap gap-2">
                            {suggestions.slice(0, 2).map((suggestion) => (
                                <button
                                    key={suggestion}
                                    type="button"
                                    onClick={() => handleStarterSelection(suggestion, 'suggestion_chip')}
                                    className="workspace-pill rounded-full px-3 py-1.5 text-xs transition-colors hover:brightness-[1.1]"
                                >
                                    {suggestion}
                                </button>
                            ))}
                        </div>
                    </ActionBar>
                )}

                <AppPanel className="p-3">
                    <div className="flex gap-3">
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            aria-label="Message to your guide"
                            placeholder={coachAvailable ? 'Ask about a memory, a lesson, a pattern, or a story you want to reuse...' : 'Guide is unavailable right now.'}
                            rows={1}
                            disabled={!coachAvailable}
                            className="workspace-input flex-1 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand))]/35 resize-none"
                        />
                        <button
                            onClick={handleSend}
                            disabled={isLoading || !input.trim() || !coachAvailable}
                            className="workspace-button-primary inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <FiSend size={16} aria-hidden="true" />
                            Send
                        </button>
                    </div>
                </AppPanel>
            </div>
        </div>
    );
}
