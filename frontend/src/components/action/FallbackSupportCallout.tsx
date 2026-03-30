'use client';

import React, { useEffect, useState } from 'react';
import { TagPill } from '@/components/ui/surface';
import { cn } from '@/utils/cn';
import { useToast } from '@/context/toast-context';
import type { StudentFallbackSupport } from './types';
import SupportOutcomeStrip from './SupportOutcomeStrip';

export default function FallbackSupportCallout({
    fallback,
    title = "If This Doesn't Land",
    surface,
    entryId,
    className,
    variant = 'default',
}: {
    fallback: StudentFallbackSupport;
    title?: string;
    surface: 'dashboard' | 'guide' | 'entry' | 'safety';
    entryId?: string | null;
    className?: string;
    variant?: 'default' | 'notebook';
}) {
    const [copied, setCopied] = useState(false);
    const [feedbackActionKind, setFeedbackActionKind] = useState<'copy' | 'text' | 'call' | 'email' | 'manual' | null>(null);
    const { toast } = useToast();
    const isNotebook = variant === 'notebook';
    const chipClass = 'inline-flex items-center rounded-full border px-2.5 py-1 text-xs uppercase tracking-[0.1em]';

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
            toast.success('Copied to clipboard!');
            window.setTimeout(() => setCopied(false), 1800);
        } catch (error) {
            console.error('Failed to copy fallback draft:', error);
        }
    };

    return (
        <div className={cn(
            isNotebook
                ? 'notebook-card-soft rounded-[1.5rem] p-4'
                : 'rounded-[1.5rem] border border-amber-300/20 bg-[linear-gradient(145deg,rgba(120,84,22,0.18),rgba(8,12,22,0.78))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
            className
        )}>
            <div className="flex flex-wrap items-center gap-2">
                <p className={isNotebook ? 'notebook-kicker' : 'text-xs uppercase tracking-[0.14em] text-ink-muted'}>{title}</p>
                {isNotebook ? (
                    <span className={cn(
                        chipClass,
                        fallback.mode === 'higher_support'
                            ? 'border-[rgba(240,205,184,0.7)] bg-[rgba(240,205,184,0.22)] text-[rgb(var(--paper-ink))]'
                            : 'border-[rgba(217,210,199,0.9)] bg-white/55 text-[rgb(var(--paper-ink-muted))]'
                    )}>
                        {fallback.mode === 'higher_support' ? 'Move up' : 'Backup contact'}
                    </span>
                ) : (
                    <TagPill tone={fallback.mode === 'higher_support' ? 'primary' : 'default'}>
                        {fallback.mode === 'higher_support' ? 'Move Up' : 'Backup Contact'}
                    </TagPill>
                )}
            </div>
            <p className={isNotebook ? 'notebook-title mt-2 text-xl' : 'mt-2 text-sm font-semibold text-white'}>{fallback.label}</p>
            <p className={isNotebook ? 'notebook-copy mt-2 text-sm leading-7' : 'mt-2 text-sm leading-7 text-white/90'}>{fallback.rationale}</p>
            <div className="mt-3 flex flex-wrap gap-2">
                {fallback.channelLabel && (
                    isNotebook ? (
                        <span className={cn(chipClass, 'border-[rgba(217,210,199,0.9)] bg-white/55 text-[rgb(var(--paper-ink-muted))]')}>
                            {fallback.channelLabel}
                        </span>
                    ) : (
                        <TagPill>{fallback.channelLabel}</TagPill>
                    )
                )}
                {fallback.relationship && (
                    isNotebook ? (
                        <span className={cn(chipClass, 'border-[rgba(217,210,199,0.9)] bg-white/55 text-[rgb(var(--paper-ink-muted))]')}>
                            {fallback.relationship}
                        </span>
                    ) : (
                        <TagPill>{fallback.relationship}</TagPill>
                    )
                )}
            </div>
            {fallback.supportMemory && (
                <div className={isNotebook ? 'notebook-card mt-3 rounded-[1.25rem] p-3' : 'mt-3 rounded-xl border border-white/10 bg-black/20 p-3'}>
                    <p className={isNotebook ? 'notebook-kicker' : 'text-xs uppercase tracking-[0.12em] text-ink-muted'}>Why this backup is visible</p>
                    <p className={isNotebook ? 'notebook-copy mt-2 text-sm leading-7' : 'mt-2 text-sm leading-7 text-white/90'}>{fallback.supportMemory.summary}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                        {fallback.supportMemory.helpedCount > 0 && (
                            isNotebook ? (
                                <span className={cn(chipClass, 'border-[rgba(199,220,203,0.7)] bg-[rgba(199,220,203,0.22)] text-[rgb(var(--paper-ink))]')}>
                                    Helped {fallback.supportMemory.helpedCount} time{fallback.supportMemory.helpedCount === 1 ? '' : 's'}
                                </span>
                            ) : (
                                <TagPill tone="primary">
                                    Helped {fallback.supportMemory.helpedCount} time{fallback.supportMemory.helpedCount === 1 ? '' : 's'}
                                </TagPill>
                            )
                        )}
                        {fallback.supportMemory.stillNeedCount > 0 && (
                            isNotebook ? (
                                <span className={cn(chipClass, 'border-[rgba(217,210,199,0.9)] bg-white/55 text-[rgb(var(--paper-ink-muted))]')}>
                                    Backup needed {fallback.supportMemory.stillNeedCount} time{fallback.supportMemory.stillNeedCount === 1 ? '' : 's'}
                                </span>
                            ) : (
                                <TagPill>
                                    Backup needed {fallback.supportMemory.stillNeedCount} time{fallback.supportMemory.stillNeedCount === 1 ? '' : 's'}
                                </TagPill>
                            )
                        )}
                    </div>
                </div>
            )}
            {fallback.draftStarter && (
                <div className={isNotebook ? 'notebook-card mt-3 rounded-[1.25rem] p-3' : 'mt-3 rounded-xl border border-white/10 bg-black/20 p-3'}>
                    <p className={isNotebook ? 'notebook-kicker' : 'text-xs uppercase tracking-[0.12em] text-ink-muted'}>What to say next</p>
                    <p className={isNotebook ? 'notebook-copy mt-2 text-sm leading-7' : 'mt-2 text-sm leading-7 text-white/90'}>{fallback.draftStarter}</p>
                    {fallback.mode === 'alternate_contact' && (
                        <button
                            type="button"
                            onClick={handleCopy}
                            className={isNotebook
                                ? 'notebook-primary-cta mt-3 rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em]'
                                : 'mt-3 rounded-full border border-amber-300/25 bg-amber-200/[0.08] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-white transition-colors hover:bg-amber-200/[0.14]'}
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
                            className={isNotebook
                                ? 'notebook-secondary-cta rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em]'
                                : 'rounded-full border border-amber-300/25 bg-amber-200/[0.08] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-white transition-colors hover:bg-amber-200/[0.14]'}
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
                        variant={variant}
                    />
                </div>
            )}
        </div>
    );
}
