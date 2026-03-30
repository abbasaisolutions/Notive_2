'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/utils/cn';
import { useToast } from '@/context/toast-context';
import type { StudentRisk, StudentSafetyCard } from '@/components/action/types';
import SupportOutcomeStrip from '@/components/action/SupportOutcomeStrip';

export default function SafetyBanner({
    risk,
    safetyCard,
    surface,
    entryId,
    compact = false,
}: {
    risk: StudentRisk;
    safetyCard: StudentSafetyCard | null;
    surface: 'dashboard' | 'guide' | 'entry' | 'safety';
    entryId?: string | null;
    compact?: boolean;
}) {
    const [copied, setCopied] = useState(false);
    const [feedbackActionKind, setFeedbackActionKind] = useState<'copy' | 'text' | 'call' | 'email' | 'manual' | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        setCopied(false);
        setFeedbackActionKind(null);
    }, [risk.level, safetyCard?.headline, safetyCard?.trustedContactId, safetyCard?.trustedContactName]);

    if (risk.level === 'none') return null;

    const toneClass = risk.level === 'red'
        ? 'border-rose-400/25 bg-rose-500/[0.10]'
        : risk.level === 'orange'
            ? 'border-amber-300/25 bg-amber-300/[0.08]'
            : 'border-white/12 bg-white/[0.04]';

    const handleCopy = async () => {
        if (!safetyCard?.draftMessage) return;
        try {
            await navigator.clipboard.writeText(safetyCard.draftMessage);
            setCopied(true);
            toast.success('Copied to clipboard!');
            if (safetyCard.trustedContactName) {
                setFeedbackActionKind('copy');
            }
            window.setTimeout(() => setCopied(false), 1800);
        } catch (error) {
            console.error('Failed to copy safety draft:', error);
        }
    };

    return (
        <div className={cn('rounded-2xl border px-4 py-4', toneClass)}>
            <p className="text-xs uppercase tracking-[0.14em] text-ink-muted">
                {risk.level === 'red' ? 'Safety Mode' : risk.level === 'orange' ? 'Support Needed' : 'Support Aware'}
            </p>
            <p className="mt-2 text-sm font-semibold text-white">
                {safetyCard?.headline || 'This moment may need more support than reflection alone.'}
            </p>
            {!compact && safetyCard?.body && (
                <p className="mt-2 text-sm leading-7 text-white/85">{safetyCard.body}</p>
            )}
            {!compact && safetyCard?.trustedContactName && (
                <p className="mt-2 text-xs uppercase tracking-[0.12em] text-ink-muted">
                    Trusted contact: {safetyCard.trustedContactChannel === 'call'
                        ? 'Call'
                        : safetyCard.trustedContactChannel === 'in_person'
                            ? 'Talk to'
                            : 'Text'} {safetyCard.trustedContactName}
                </p>
            )}
            {safetyCard && (
                <div className="mt-3 flex flex-wrap gap-2">
                    <a
                        href={safetyCard.primaryActionHref}
                        className="rounded-full border border-white/15 bg-white/[0.05] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-white transition-colors hover:bg-white/[0.1]"
                    >
                        {safetyCard.primaryActionLabel}
                    </a>
                    {safetyCard.secondaryActionHref && safetyCard.secondaryActionLabel && (
                        <a
                            href={safetyCard.secondaryActionHref}
                            className="rounded-full border border-white/12 bg-black/20 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-ink-secondary transition-colors hover:bg-black/30 hover:text-white"
                        >
                            {safetyCard.secondaryActionLabel}
                        </a>
                    )}
                    {(safetyCard.contactActions || []).map((action) => (
                        <a
                            key={`${action.kind}-${action.href}`}
                            href={action.href}
                            onClick={() => setFeedbackActionKind(action.kind)}
                            className="rounded-full border border-white/12 bg-black/20 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-ink-secondary transition-colors hover:bg-black/30 hover:text-white"
                        >
                            {action.label}
                        </a>
                    ))}
                    {safetyCard.draftMessage && (
                        <button
                            type="button"
                            onClick={handleCopy}
                            className="rounded-full border border-white/12 bg-black/20 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-ink-secondary transition-colors hover:bg-black/30 hover:text-white"
                        >
                            {copied
                                ? 'Copied'
                                : safetyCard.trustedContactName
                                    ? `Copy message for ${safetyCard.trustedContactName}`
                                    : 'Copy help message'}
                        </button>
                    )}
                </div>
            )}
            {safetyCard?.trustedContactName && feedbackActionKind && (
                <div className="mt-3">
                    <SupportOutcomeStrip
                        contactId={safetyCard.trustedContactId || null}
                        contactName={safetyCard.trustedContactName}
                        channel={safetyCard.trustedContactChannel}
                        surface={surface}
                        source="safety"
                        riskLevel={risk.level}
                        entryId={entryId || null}
                        actionKind={feedbackActionKind}
                    />
                </div>
            )}
        </div>
    );
}
