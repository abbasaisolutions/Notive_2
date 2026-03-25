'use client';

import React, { useEffect, useState } from 'react';
import { TagPill } from '@/components/ui/surface';
import { cn } from '@/utils/cn';
import type { StudentFallbackSupport } from './types';
import SupportOutcomeStrip from './SupportOutcomeStrip';

export default function FallbackSupportCallout({
    fallback,
    title = "If This Doesn't Land",
    surface,
    entryId,
    className,
}: {
    fallback: StudentFallbackSupport;
    title?: string;
    surface: 'dashboard' | 'guide' | 'entry' | 'safety';
    entryId?: string | null;
    className?: string;
}) {
    const [copied, setCopied] = useState(false);
    const [feedbackActionKind, setFeedbackActionKind] = useState<'copy' | 'text' | 'call' | 'email' | 'manual' | null>(null);

    useEffect(() => {
        setCopied(false);
        setFeedbackActionKind(null);
    }, [fallback.contactId, fallback.label, fallback.draftStarter]);

    const handleCopy = async () => {
        if (!fallback.draftStarter) return;
        try {
            await navigator.clipboard.writeText(fallback.draftStarter);
            setCopied(true);
            setFeedbackActionKind('copy');
            window.setTimeout(() => setCopied(false), 1800);
        } catch (error) {
            console.error('Failed to copy fallback draft:', error);
        }
    };

    return (
        <div className={cn('rounded-[1.5rem] border border-amber-300/20 bg-[linear-gradient(145deg,rgba(120,84,22,0.18),rgba(8,12,22,0.78))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]', className)}>
            <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs uppercase tracking-[0.14em] text-ink-muted">{title}</p>
                <TagPill tone={fallback.mode === 'higher_support' ? 'primary' : 'default'}>
                    {fallback.mode === 'higher_support' ? 'Move Up' : 'Backup Contact'}
                </TagPill>
            </div>
            <p className="mt-2 text-sm font-semibold text-white">{fallback.label}</p>
            <p className="mt-2 text-sm leading-7 text-white/90">{fallback.rationale}</p>
            <div className="mt-3 flex flex-wrap gap-2">
                {fallback.channelLabel && <TagPill>{fallback.channelLabel}</TagPill>}
                {fallback.relationship && <TagPill>{fallback.relationship}</TagPill>}
            </div>
            {fallback.supportMemory && (
                <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
                    <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Why this backup is visible</p>
                    <p className="mt-2 text-sm leading-7 text-white/90">{fallback.supportMemory.summary}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                        {fallback.supportMemory.helpedCount > 0 && (
                            <TagPill tone="primary">
                                Helped {fallback.supportMemory.helpedCount} time{fallback.supportMemory.helpedCount === 1 ? '' : 's'}
                            </TagPill>
                        )}
                        {fallback.supportMemory.stillNeedCount > 0 && (
                            <TagPill>
                                Backup needed {fallback.supportMemory.stillNeedCount} time{fallback.supportMemory.stillNeedCount === 1 ? '' : 's'}
                            </TagPill>
                        )}
                    </div>
                </div>
            )}
            {fallback.draftStarter && (
                <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
                    <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">What to say next</p>
                    <p className="mt-2 text-sm leading-7 text-white/90">{fallback.draftStarter}</p>
                    {fallback.mode === 'alternate_contact' && (
                        <button
                            type="button"
                            onClick={handleCopy}
                            className="mt-3 rounded-full border border-amber-300/25 bg-amber-200/[0.08] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-white transition-colors hover:bg-amber-200/[0.14]"
                        >
                            {copied ? 'Copied' : 'Copy draft'}
                        </button>
                    )}
                </div>
            )}
            {(fallback.contactActions || []).length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                    {(fallback.contactActions || []).map((action) => (
                        <a
                            key={`${fallback.label}-${action.kind}-${action.href}`}
                            href={action.href}
                            onClick={() => setFeedbackActionKind(action.kind)}
                            className="rounded-full border border-amber-300/25 bg-amber-200/[0.08] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-white transition-colors hover:bg-amber-200/[0.14]"
                        >
                            {action.label}
                        </a>
                    ))}
                </div>
            )}
            {fallback.mode === 'alternate_contact' && feedbackActionKind && (
                <div className="mt-3">
                    <SupportOutcomeStrip
                        contactId={fallback.contactId || null}
                        contactName={fallback.label}
                        channel={fallback.channel}
                        surface={surface}
                        source="bridge"
                        entryId={entryId || null}
                        actionKind={feedbackActionKind}
                    />
                </div>
            )}
        </div>
    );
}
