'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import useApi from '@/hooks/use-api';
import { API_URL } from '@/constants/config';
import useAuthRedirect from '@/hooks/use-auth-redirect';
import { NOTIVE_VOICE } from '@/content/notive-voice';
import useContextNavigation from '@/hooks/use-context-navigation';
import { ActionBar, AppPanel, EmptyState, SectionHeader, TagPill } from '@/components/ui/surface';
import { FiArrowLeft, FiArrowRight, FiChevronDown, FiCpu, FiSend } from 'react-icons/fi';
import ActionBriefPanel from '@/components/action/ActionBriefPanel';
import BridgeCard from '@/components/action/BridgeCard';
import SafetyBanner from '@/components/safety/SafetyBanner';
import type { StudentActionBrief, StudentBridgeDraft, StudentRisk, StudentSafetyCard } from '@/components/action/types';
import useTelemetry from '@/hooks/use-telemetry';

type GuidedLens = 'clarity' | 'memory' | 'growth' | 'patterns' | 'bridge';

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
    const { isLoading: authLoading, isAuthenticated } = useAuthRedirect();
    const { apiFetch } = useApi();
    const { trackEvent } = useTelemetry();
    const { backLabel, navigateBack } = useContextNavigation('/dashboard', 'dashboard');
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [coachStatus, setCoachStatus] = useState<CoachStatus | null>(null);
    const [selectedLens, setSelectedLens] = useState<GuidedLens>('clarity');
    const [requestedLens, setRequestedLens] = useState<GuidedLens | null>(null);
    const [showLensOptions, setShowLensOptions] = useState(false);
    const [showStarterOptions, setShowStarterOptions] = useState(false);
    const [isStatusLoading, setIsStatusLoading] = useState(true);
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
        ) {
            setRequestedLens(lens);
        }
    }, []);

    useEffect(() => {
        let mounted = true;

        const fetchCoachStatus = async () => {
            try {
                const response = await apiFetch(`${API_URL}/ai/status`);
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
        'What feels like the biggest pattern in my notes lately?',
        'Help me talk to someone about this.',
        'Which past entry feels closest to how I am doing now?',
        'What should I write about tonight?',
    ];
    const guidedLenses = coachStatus?.lenses || [];
    const lensLabelMap = new Map(guidedLenses.map((lens) => [lens.id, lens.label]));
    const selectedLensLabel = lensLabelMap.get(selectedLens) || selectedLens;
    const selectedLensDefinition = guidedLenses.find((lens) => lens.id === selectedLens);
    const hasMoreSuggestions = suggestions.length > 2;
    const starterDeckSuggestions = showStarterOptions ? suggestions.slice(0, 4) : suggestions.slice(0, 2);
    const quickSuggestionChips = showStarterOptions ? suggestions : suggestions.slice(0, 2);
    const headerDescription = coachMode === 'guided'
        ? selectedLens === 'bridge'
            ? 'Turn a hard conversation into a grounded draft, a smaller talk track, and one human next step.'
            : 'Use local reflection mode to surface relevant notes, patterns, and your next writing question.'
        : coachAvailable
            ? 'Ask Notive about your notes, your patterns, or what to write next.'
            : 'This environment is running without a live guide right now.';

    const describeStarter = (suggestion: string) => {
        const normalized = suggestion.toLowerCase();
        if (normalized.includes('talk to') || normalized.includes('message') || normalized.includes('text') || normalized.includes('say')) {
            return 'Get a grounded draft and a smaller talk track before you reach out.';
        }
        if (normalized.includes('pattern')) return 'Spot the thread that keeps coming back instead of rereading everything.';
        if (normalized.includes('write') || normalized.includes('prompt')) return 'Turn the archive into one grounded prompt you can answer tonight.';
        if (normalized.includes('closest') || normalized.includes('past') || normalized.includes('similar')) return 'Reconnect the present moment to an earlier note that matches.';
        if (normalized.includes('week') || normalized.includes('summary')) return 'Zoom out and get a stitched-together view of recent notes.';
        return coachMode === 'guided'
            ? 'Keep the next question grounded in your own notes and patterns.'
            : 'Start with a narrower question so the guide can be more useful.';
    };
    const starterDeckCardClassName = coachMode === 'guided' && selectedLens === 'bridge'
        ? 'rounded-[1.4rem] border border-amber-300/20 bg-[linear-gradient(135deg,rgba(120,84,22,0.22),rgba(8,12,22,0.84))] p-5 text-left transition-colors hover:border-amber-200/30 hover:bg-[linear-gradient(135deg,rgba(140,98,28,0.30),rgba(8,12,22,0.92))]'
        : 'rounded-[1.4rem] border border-white/12 bg-[linear-gradient(135deg,rgba(36,56,96,0.22),rgba(8,12,22,0.82))] p-5 text-left transition-colors hover:border-white/20 hover:bg-[linear-gradient(135deg,rgba(46,70,116,0.32),rgba(8,12,22,0.92))]';
    const starterDeckTagTone: 'default' | 'primary' | 'muted' = coachMode === 'guided' && selectedLens === 'bridge'
        ? 'default'
        : coachMode === 'guided'
            ? 'primary'
            : 'muted';

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
        const hasMetadata = !!message.meta.strategy || !!message.meta.lens || !!message.meta.brief || !!message.meta.bridge || !!message.meta.risk;
        if (!hasHighlights && !hasPrompts && !hasMetadata) return null;

        const isGuidedReflection = message.meta.mode === 'guided_reflection';
        const isBridgeMode = message.meta.lens === 'bridge';

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

                {isBridgeMode && message.meta.bridge && (
                    <BridgeCard
                        bridge={message.meta.bridge}
                        surface="guide"
                        openEntryHref={(entryId) => `/entry/view?id=${entryId}`}
                        onCopyDraft={() => handleBridgeCopy(message.meta?.bridge?.recommendedRecipient || 'trusted contact', 'guide_card')}
                    />
                )}

                {message.meta.brief && (
                    <ActionBriefPanel
                        brief={message.meta.brief}
                        surface="guide"
                        openEntryHref={(entryId) => `/entry/view?id=${entryId}`}
                    />
                )}

                {!isBridgeMode && message.meta.bridge && (
                    <BridgeCard
                        bridge={message.meta.bridge}
                        surface="guide"
                        openEntryHref={(entryId) => `/entry/view?id=${entryId}`}
                        onCopyDraft={() => handleBridgeCopy(message.meta?.bridge?.recommendedRecipient || 'trusted contact', 'guide_card')}
                    />
                )}

                <div className="flex flex-wrap gap-2">
                    {message.meta.lens && <TagPill tone="primary">{lensLabelMap.get(message.meta.lens) || message.meta.lens}</TagPill>}
                    {message.meta.strategy && <TagPill>{message.meta.strategy}</TagPill>}
                    {!isGuidedReflection && message.meta.model && <TagPill>{message.meta.model}</TagPill>}
                </div>

                {hasHighlights && (
                    <div className="grid gap-2 md:grid-cols-2">
                        {message.meta.highlights?.map((highlight) => (
                            <Link
                                key={`${index}-${highlight.id}`}
                                href={`/entry/view?id=${highlight.id}`}
                                className="rounded-xl border border-white/10 bg-black/20 px-3 py-3 transition-colors hover:border-white/15 hover:bg-black/30"
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">{highlight.createdAt}</p>
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

                {hasPrompts && (
                    <div className="flex flex-wrap gap-2">
                        {message.meta.prompts?.map((prompt) => (
                            <button
                                key={`${index}-${prompt}`}
                                type="button"
                                onClick={() => handleStarterSelection(prompt, 'follow_up_prompt')}
                                className="rounded-full border border-white/12 bg-white/[0.03] px-3 py-1.5 text-xs text-ink-secondary hover:text-white hover:bg-white/10 transition-colors"
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
                            title={coachMode === 'guided' ? 'Action Console' : NOTIVE_VOICE.surfaces.reflectionCoach}
                            description={headerDescription}
                            kicker={coachMode === 'guided' ? selectedLensLabel : 'Guide'}
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
                            <div className="space-y-4 rounded-2xl border border-primary/20 bg-primary/10 px-4 py-4 text-sm text-white/85">
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                    <div className="max-w-2xl">
                                        <p className="font-medium text-white">Guided reflection mode</p>
                                        <h2 className="mt-2 text-xl font-semibold text-white">Current lens: {selectedLensLabel}</h2>
                                        <p className="mt-2">{selectedLensDefinition?.description || coachMessage}</p>
                                        <p className="mt-2 text-white/80">It stays grounded in your own notes, related entries, and fixed reflection prompts instead of open-ended generation.</p>
                                    </div>
                                    {guidedLenses.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => setShowLensOptions((current) => !current)}
                                            className="inline-flex items-center gap-2 self-start rounded-xl border border-white/12 bg-white/[0.05] px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white transition-colors hover:bg-white/[0.1]"
                                            aria-expanded={showLensOptions}
                                        >
                                            {showLensOptions ? 'Keep this lens' : 'Change lens'}
                                            <FiChevronDown size={14} className={`transition-transform ${showLensOptions ? 'rotate-180' : ''}`} aria-hidden="true" />
                                        </button>
                                    )}
                                </div>
                                {showLensOptions && guidedLenses.length > 0 && (
                                    <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-5">
                                        {guidedLenses.map((lens) => {
                                            const active = selectedLens === lens.id;
                                            return (
                                                <button
                                                    key={lens.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedLens(lens.id);
                                                        setShowLensOptions(false);
                                                    }}
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
                            <div className="space-y-4 py-6">
                                <EmptyState
                                    title={coachMode === 'guided'
                                        ? selectedLens === 'bridge'
                                            ? 'Draft the conversation before you have it'
                                            : 'Pick a lens and begin'
                                        : 'Ask Notive anything'}
                                    description={coachAvailable
                                        ? selectedLens === 'bridge'
                                            ? 'Use a starter below or name the person you need to talk to and what feels hard to say.'
                                            : 'Use one of the reflection starters below or type your own question.'
                                        : 'Come back when a guide provider is enabled to use chat.'}
                                    className="py-8"
                                />

                                {coachAvailable && (
                                    <div className="grid gap-3 md:grid-cols-2">
                                        {starterDeckSuggestions.map((suggestion) => (
                                            <button
                                                key={suggestion}
                                                type="button"
                                                onClick={() => handleStarterSelection(suggestion, 'starter_deck')}
                                                className={starterDeckCardClassName}
                                            >
                                                <div className="flex items-center justify-between gap-3">
                                                    <TagPill tone={starterDeckTagTone}>
                                                        {coachMode === 'guided' ? `${selectedLensLabel} lens` : 'Guide starter'}
                                                    </TagPill>
                                                    <FiArrowRight size={14} className="text-ink-muted" aria-hidden="true" />
                                                </div>
                                                <p className="mt-4 text-base font-semibold leading-7 text-white">{suggestion}</p>
                                                <p className="mt-2 text-sm leading-7 text-ink-secondary">{describeStarter(suggestion)}</p>
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {coachAvailable && hasMoreSuggestions && (
                                    <button
                                        type="button"
                                        onClick={() => setShowStarterOptions((current) => !current)}
                                        className="inline-flex items-center gap-2 rounded-xl border border-white/12 bg-white/[0.03] px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink-secondary transition-colors hover:bg-white/[0.06] hover:text-white"
                                        aria-expanded={showStarterOptions}
                                    >
                                        {showStarterOptions ? 'Show fewer starters' : 'See more starters'}
                                        <FiChevronDown size={14} className={`transition-transform ${showStarterOptions ? 'rotate-180' : ''}`} aria-hidden="true" />
                                    </button>
                                )}
                            </div>
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

                                        {renderMessageMeta(message, index)}
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

                {coachAvailable && messages.length > 0 && (
                    <ActionBar className="items-start justify-between gap-4">
                        <div className="space-y-2">
                            <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">
                                {coachMode === 'guided' ? 'Try another prompt' : 'Quick starters'}
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {quickSuggestionChips.map((suggestion) => (
                                    <button
                                        key={suggestion}
                                        type="button"
                                        onClick={() => handleStarterSelection(suggestion, 'suggestion_chip')}
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
                        {hasMoreSuggestions && (
                            <button
                                type="button"
                                onClick={() => setShowStarterOptions((current) => !current)}
                                className="inline-flex items-center gap-2 rounded-xl border border-white/12 bg-white/[0.03] px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink-secondary transition-colors hover:bg-white/[0.06] hover:text-white"
                                aria-expanded={showStarterOptions}
                            >
                                {showStarterOptions ? 'Show fewer' : 'More starters'}
                                <FiChevronDown size={14} className={`transition-transform ${showStarterOptions ? 'rotate-180' : ''}`} aria-hidden="true" />
                            </button>
                        )}
                    </ActionBar>
                )}

                <AppPanel className="p-3">
                    <div className="flex gap-3">
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={
                                coachMode === 'guided'
                                    ? selectedLens === 'bridge'
                                        ? 'Who do you need to talk to, and what feels hard to say?...'
                                        : 'Describe what you want to reflect on, or choose a starter above...'
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
                            {coachMode === 'guided'
                                ? selectedLens === 'bridge'
                                    ? 'Build Draft'
                                    : 'Continue'
                                : coachAvailable
                                    ? 'Send'
                                    : 'Unavailable'}
                        </button>
                    </div>
                </AppPanel>
            </div>
        </div>
    );
}
