'use client';

import React, { useEffect } from 'react';
import type { StudentRisk, StudentSafetyCard } from '@/components/action/types';

export { SAFETY_ALERTS_PREF_KEY, isSafetyAlertsEnabled } from '@/utils/safety-alerts';

type PostSaveSafetyDialogProps = {
    risk: StudentRisk;
    safetyCard: StudentSafetyCard | null;
    onContinue: () => void;
};

export default function PostSaveSafetyDialog({ risk, safetyCard, onContinue }: PostSaveSafetyDialogProps) {
    useEffect(() => {
        const handleKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onContinue();
        };
        window.addEventListener('keydown', handleKey);
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            window.removeEventListener('keydown', handleKey);
            document.body.style.overflow = previousOverflow;
        };
    }, [onContinue]);

    if (risk.level === 'none') return null;

    const tone = risk.level === 'red' ? 'urgent' : 'supportive';
    const accentBorder = tone === 'urgent'
        ? 'border-rose-400/40'
        : 'border-amber-300/30';
    const eyebrowLabel = risk.level === 'red'
        ? 'A pause before you go'
        : risk.level === 'orange'
            ? 'Before you go'
            : 'A soft check-in';

    const headline = safetyCard?.headline
        || (risk.level === 'red'
            ? 'Your safety matters more than finishing this.'
            : 'This sounds heavy — and worth support.');

    const body = safetyCard?.body
        || 'Your note is saved. Before you go, here are a few options if you want them.';

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="post-save-safety-headline"
            className="fixed inset-0 z-[100] flex items-end justify-center bg-[rgba(20,18,14,0.4)] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-8 backdrop-blur-sm sm:items-center sm:pb-8"
        >
            <div
                className={`notebook-card-soft relative w-full max-w-md overflow-hidden rounded-3xl border-2 ${accentBorder} p-5 shadow-2xl`}
            >
                <p
                    className="section-label"
                    style={{ fontStyle: 'italic', fontFamily: 'var(--font-serif, Georgia, serif)' }}
                >
                    {eyebrowLabel}
                </p>
                <h2
                    id="post-save-safety-headline"
                    className="notebook-copy mt-2 text-lg font-semibold"
                    style={{ color: 'rgb(var(--paper-ink))' }}
                >
                    {headline}
                </h2>
                <p
                    className="notebook-copy mt-2 text-sm leading-relaxed"
                    style={{ color: 'rgb(var(--paper-ink-soft))' }}
                >
                    {body}
                </p>

                {safetyCard?.trustedContactName && (
                    <p
                        className="notebook-muted mt-3 text-xs uppercase tracking-[0.12em]"
                        style={{ color: 'rgb(155 143 120)' }}
                    >
                        Trusted contact: {safetyCard.trustedContactChannel === 'call'
                            ? 'Call'
                            : safetyCard.trustedContactChannel === 'in_person'
                                ? 'Talk to'
                                : 'Text'} {safetyCard.trustedContactName}
                    </p>
                )}

                {safetyCard && (
                    <div className="mt-4 flex flex-wrap gap-2">
                        <a
                            href={safetyCard.primaryActionHref}
                            className="rounded-full border border-[rgba(0,0,0,0.15)] bg-[rgb(var(--brand-strong))] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                        >
                            {safetyCard.primaryActionLabel}
                        </a>
                        {safetyCard.secondaryActionHref && safetyCard.secondaryActionLabel && (
                            <a
                                href={safetyCard.secondaryActionHref}
                                className="rounded-full border border-[rgba(0,0,0,0.12)] bg-[rgba(0,0,0,0.03)] px-4 py-2 text-sm font-medium transition-colors hover:bg-[rgba(0,0,0,0.06)]"
                                style={{ color: 'rgb(var(--paper-ink))' }}
                            >
                                {safetyCard.secondaryActionLabel}
                            </a>
                        )}
                        {(safetyCard.contactActions || []).slice(0, 1).map((action) => (
                            <a
                                key={`${action.kind}-${action.href}`}
                                href={action.href}
                                className="rounded-full border border-[rgba(0,0,0,0.12)] bg-[rgba(0,0,0,0.03)] px-4 py-2 text-sm font-medium transition-colors hover:bg-[rgba(0,0,0,0.06)]"
                                style={{ color: 'rgb(var(--paper-ink))' }}
                            >
                                {action.label}
                            </a>
                        ))}
                    </div>
                )}

                <div className="mt-5 flex items-center justify-between gap-3">
                    <button
                        type="button"
                        onClick={onContinue}
                        className="notebook-muted text-sm transition-opacity hover:opacity-70"
                        style={{ color: 'rgb(155 143 120)' }}
                    >
                        Keep going
                    </button>
                    <a
                        href="/profile/edit?section=safety"
                        className="notebook-muted text-xs underline-offset-4 transition-opacity hover:underline hover:opacity-80"
                        style={{ color: 'rgb(155 143 120)' }}
                    >
                        Manage safety alerts
                    </a>
                </div>
            </div>
        </div>
    );
}
