'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppPanel, TagPill } from '@/components/ui/surface';
import { cn } from '@/utils/cn';
import FallbackSupportCallout from './FallbackSupportCallout';
import SupportMemoryCallout from './SupportMemoryCallout';
import type { StudentBridgeDraft } from './types';
import SupportOutcomeStrip from './SupportOutcomeStrip';

export default function BridgeCard({
    bridge,
    surface,
    entryId,
    openEntryHref,
    onCopyDraft,
}: {
    bridge: StudentBridgeDraft;
    surface: 'dashboard' | 'guide' | 'entry' | 'safety';
    entryId?: string | null;
    openEntryHref?: (entryId: string) => string;
    onCopyDraft?: () => void;
}) {
    const [copied, setCopied] = useState(false);
    const [feedbackActionKind, setFeedbackActionKind] = useState<'copy' | 'text' | 'call' | 'email' | 'manual' | null>(null);
    const hasSupportContext = Boolean(bridge.supportMemory || bridge.fallbackSupport);

    useEffect(() => {
        setCopied(false);
        setFeedbackActionKind(null);
    }, [bridge.contactId, bridge.recommendedRecipient, bridge.messageDraft]);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(bridge.messageDraft);
            setCopied(true);
            setFeedbackActionKind('copy');
            onCopyDraft?.();
            window.setTimeout(() => setCopied(false), 1800);
        } catch (error) {
            console.error('Failed to copy bridge draft:', error);
        }
    };

    return (
        <AppPanel className="signal-lines space-y-4 border-amber-300/20 bg-[linear-gradient(135deg,rgba(132,88,28,0.16),rgba(8,12,22,0.82))]">
            <div className="flex flex-wrap items-center gap-2">
                <TagPill>Bridge Builder</TagPill>
                <TagPill tone="primary">{bridge.recommendedRecipient}</TagPill>
                {bridge.channelLabel && <TagPill>{bridge.channelLabel}</TagPill>}
                {bridge.relationship && <TagPill>{bridge.relationship}</TagPill>}
            </div>

            <div>
                <p className="text-xs uppercase tracking-[0.14em] text-ink-muted">Why Now</p>
                <p className="mt-2 text-sm leading-7 text-white/90">{bridge.whyNow}</p>
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
                        />
                    )}

                    {bridge.fallbackSupport && (
                        <FallbackSupportCallout
                            fallback={bridge.fallbackSupport}
                            surface={surface}
                            entryId={entryId || null}
                        />
                    )}
                </div>
            )}

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-ink-muted">What To Say</p>
                <p className="mt-2 text-sm leading-7 text-white">{bridge.messageDraft}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                    {(bridge.contactActions || []).map((action) => (
                        <a
                            key={`${action.kind}-${action.href}`}
                            href={action.href}
                            onClick={() => setFeedbackActionKind(action.kind)}
                            className="rounded-full border border-amber-300/25 bg-amber-200/[0.08] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-white transition-colors hover:bg-amber-200/[0.14]"
                        >
                            {action.label}
                        </a>
                    ))}
                    <button
                        type="button"
                        onClick={handleCopy}
                        className="rounded-full border border-white/12 bg-black/20 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-ink-secondary transition-colors hover:bg-black/30 hover:text-white"
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
                />
            )}

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-ink-muted">Talk Track</p>
                <div className="mt-2 space-y-2">
                    {bridge.talkTrack.map((item, index) => (
                        <p key={`${index}-${item}`} className="text-sm leading-7 text-ink-secondary">
                            {index + 1}. {item}
                        </p>
                    ))}
                </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-ink-muted">Grounding</p>
                <p className="mt-2 text-sm leading-7 text-ink-secondary">{bridge.evidenceSummary}</p>
                {bridge.groundingEntryIds[0] && openEntryHref && (
                    <Link
                        href={openEntryHref(bridge.groundingEntryIds[0])}
                        className="mt-3 inline-flex rounded-full border border-white/12 bg-white/[0.03] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-ink-secondary transition-colors hover:bg-white/[0.08] hover:text-white"
                    >
                        Open grounding note
                    </Link>
                )}
            </div>
        </AppPanel>
    );
}
