'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppPanel, TagPill } from '@/components/ui/surface';
import { cn } from '@/utils/cn';
import { useToast } from '@/context/toast-context';
import { clipCompactPillByLimit, COMPACT_PILL_LIMITS } from '@/utils/tags';
import FallbackSupportCallout from './FallbackSupportCallout';
import SupportMemoryCallout from './SupportMemoryCallout';
import type { StudentBridgeDraft } from './types';
import SupportOutcomeStrip from './SupportOutcomeStrip';

type BridgeCardVariant = 'default' | 'notebook';

function BridgeTag({
    children,
    tone = 'default',
    variant = 'default',
    title,
    className,
}: {
    children: React.ReactNode;
    tone?: 'default' | 'primary';
    variant?: BridgeCardVariant;
    title?: string;
    className?: string;
}) {
    if (variant === 'notebook') {
        return (
            <span
                title={title}
                className={cn(
                    'inline-flex items-center rounded-full border px-2.5 py-1 text-xs uppercase tracking-[0.1em]',
                    tone === 'primary'
                        ? 'border-[rgba(240,205,184,0.72)] bg-[rgba(240,205,184,0.24)] text-[rgb(var(--paper-ink))]'
                        : 'border-[rgba(217,210,199,0.9)] bg-white/55 text-[rgb(var(--paper-ink-muted))]',
                    className,
                )}
            >
                {children}
            </span>
        );
    }

    return <TagPill title={title} className={className} tone={tone === 'primary' ? 'primary' : 'default'}>{children}</TagPill>;
}

export default function BridgeCard({
    bridge,
    surface,
    entryId,
    openEntryHref,
    onCopyDraft,
    variant = 'default',
}: {
    bridge: StudentBridgeDraft;
    surface: 'dashboard' | 'guide' | 'entry' | 'safety';
    entryId?: string | null;
    openEntryHref?: (entryId: string) => string;
    onCopyDraft?: () => void;
    variant?: BridgeCardVariant;
}) {
    const [copied, setCopied] = useState(false);
    const [feedbackActionKind, setFeedbackActionKind] = useState<'copy' | 'text' | 'call' | 'email' | 'manual' | null>(null);
    const toast = useToast();
    const hasSupportContext = Boolean(bridge.supportMemory || bridge.fallbackSupport);
    const isNotebook = variant === 'notebook';

    useEffect(() => {
        setCopied(false);
        setFeedbackActionKind(null);
    }, [bridge.contactId, bridge.recommendedRecipient, bridge.messageDraft]);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(bridge.messageDraft);
            setCopied(true);
            setFeedbackActionKind('copy');
            toast.success('Copied to clipboard!');
            onCopyDraft?.();
            window.setTimeout(() => setCopied(false), 1800);
        } catch (error) {
            console.error('Failed to copy bridge draft:', error);
        }
    };

    const content = (
        <>
            <div className="flex flex-wrap items-center gap-2">
                <BridgeTag variant={variant}>Bridge Builder</BridgeTag>
                <BridgeTag
                    tone="primary"
                    variant={variant}
                    title={bridge.recommendedRecipient}
                    className="max-w-[10rem] truncate"
                >
                    {clipCompactPillByLimit(bridge.recommendedRecipient, COMPACT_PILL_LIMITS.bridgePrimary)}
                </BridgeTag>
                {bridge.channelLabel && (
                    <BridgeTag
                        variant={variant}
                        title={bridge.channelLabel}
                        className="max-w-[8rem] truncate"
                    >
                        {clipCompactPillByLimit(bridge.channelLabel, COMPACT_PILL_LIMITS.bridgeMeta)}
                    </BridgeTag>
                )}
                {bridge.relationship && (
                    <BridgeTag
                        variant={variant}
                        title={bridge.relationship}
                        className="max-w-[8rem] truncate"
                    >
                        {clipCompactPillByLimit(bridge.relationship, COMPACT_PILL_LIMITS.bridgeMeta)}
                    </BridgeTag>
                )}
            </div>

            <div>
                <p className={isNotebook ? 'section-label' : 'text-xs uppercase tracking-[0.14em] text-ink-muted'}>Why now</p>
                <p
                    className={isNotebook ? 'notebook-copy mt-2 text-[0.95rem] leading-7' : 'mt-2 text-sm leading-7 text-white/90'}
                    style={isNotebook ? { color: 'rgb(var(--paper-ink-soft))' } : undefined}
                >
                    {bridge.whyNow}
                </p>
            </div>

            {hasSupportContext && (
                <div className={cn(
                    'grid gap-3',
                    bridge.supportMemory && bridge.fallbackSupport ? 'lg:grid-cols-2' : 'grid-cols-1'
                )}>
                    {bridge.supportMemory && (
                        <SupportMemoryCallout
                            memory={bridge.supportMemory}
                            title="Why This Person Is Showing Up"
                            variant={variant}
                        />
                    )}

                    {bridge.fallbackSupport && (
                        <FallbackSupportCallout
                            fallback={bridge.fallbackSupport}
                            surface={surface}
                            entryId={entryId || null}
                            variant={variant}
                        />
                    )}
                </div>
            )}

            <div className={isNotebook ? 'notebook-card-soft rounded-[1.5rem] p-4' : 'rounded-2xl border border-white/10 bg-black/20 p-4'}>
                <p className={isNotebook ? 'section-label' : 'text-xs uppercase tracking-[0.14em] text-ink-muted'}>What to say</p>
                <p
                    className={isNotebook ? 'mt-2 text-[0.98rem] leading-7 text-[rgb(var(--paper-ink))]' : 'mt-2 text-sm leading-7 text-white'}
                >
                    {bridge.messageDraft}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                    {(bridge.contactActions || []).map((action) => (
                        <a
                            key={`${action.kind}-${action.href}`}
                            href={action.href}
                            onClick={() => setFeedbackActionKind(action.kind)}
                            className={isNotebook
                                ? 'notebook-secondary-cta rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em]'
                                : 'rounded-full border border-amber-300/25 bg-amber-200/[0.08] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-white transition-colors hover:bg-amber-200/[0.14]'}
                        >
                            {action.label}
                        </a>
                    ))}
                    <button
                        type="button"
                        onClick={handleCopy}
                        className={isNotebook
                            ? 'notebook-primary-cta rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em]'
                            : 'rounded-full border border-white/12 bg-black/20 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-ink-secondary transition-colors hover:bg-black/30 hover:text-white'}
                    >
                        {copied ? 'Copied' : 'Copy draft'}
                    </button>
                </div>
            </div>

            {feedbackActionKind && (
                <SupportOutcomeStrip
                    contactId={bridge.contactId || null}
                    contactName={bridge.recommendedRecipient}
                    channel={bridge.channel}
                    surface={surface}
                    source="bridge"
                    actionKind={feedbackActionKind}
                    entryId={entryId || null}
                    variant={variant}
                />
            )}

            <div className={isNotebook ? 'notebook-card rounded-[1.5rem] p-4' : 'rounded-2xl border border-white/10 bg-white/[0.03] p-4'}>
                <p className={isNotebook ? 'section-label' : 'text-xs uppercase tracking-[0.14em] text-ink-muted'}>Talk track</p>
                <div className="mt-2 space-y-2">
                    {bridge.talkTrack.map((item, index) => (
                        <p
                            key={`${index}-${item}`}
                            className={isNotebook ? 'text-[0.95rem] leading-7 text-[rgb(var(--paper-ink-soft))]' : 'text-sm leading-7 text-ink-secondary'}
                        >
                            {index + 1}. {item}
                        </p>
                    ))}
                </div>
            </div>

            <div className={isNotebook ? 'notebook-card rounded-[1.5rem] p-4' : 'rounded-2xl border border-white/10 bg-white/[0.03] p-4'}>
                <p className={isNotebook ? 'section-label' : 'text-xs uppercase tracking-[0.14em] text-ink-muted'}>Grounding</p>
                <p
                    className={isNotebook ? 'notebook-copy mt-2 text-[0.95rem] leading-7' : 'mt-2 text-sm leading-7 text-ink-secondary'}
                    style={isNotebook ? { color: 'rgb(var(--paper-ink-soft))' } : undefined}
                >
                    {bridge.evidenceSummary}
                </p>
                {bridge.groundingEntryIds[0] && openEntryHref && (
                    <Link
                        href={openEntryHref(bridge.groundingEntryIds[0])}
                        className={isNotebook
                            ? 'notebook-secondary-cta mt-3 inline-flex rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em]'
                            : 'mt-3 inline-flex rounded-full border border-white/12 bg-white/[0.03] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-ink-secondary transition-colors hover:bg-white/[0.08] hover:text-white'}
                    >
                        Open grounding note
                    </Link>
                )}
            </div>
        </>
    );

    if (isNotebook) {
        return (
            <section className="notebook-card space-y-4 rounded-[1.75rem] p-5 md:p-6">
                {content}
            </section>
        );
    }

    return (
        <AppPanel className="signal-lines space-y-4 border-amber-300/20 bg-[linear-gradient(135deg,rgba(132,88,28,0.16),rgba(8,12,22,0.82))]">
            {content}
        </AppPanel>
    );
}
