'use client';

import React from 'react';
import Link from 'next/link';
import { AppPanel, TagPill } from '@/components/ui/surface';
import { cn } from '@/utils/cn';
import FallbackSupportCallout from './FallbackSupportCallout';
import SupportMemoryCallout from './SupportMemoryCallout';
import type { StudentActionBrief } from './types';

export default function ActionBriefPanel({
    brief,
    surface = 'guide',
    entryId,
    openEntryHref,
}: {
    brief: StudentActionBrief;
    surface?: 'dashboard' | 'guide' | 'entry' | 'safety';
    entryId?: string | null;
    openEntryHref?: (entryId: string) => string;
}) {
    const hasSupportContext = Boolean(brief.reachOut?.supportMemory || brief.reachOut?.fallbackSupport);

    return (
        <AppPanel className="signal-lines space-y-4 border-white/15 bg-[linear-gradient(135deg,rgba(36,56,96,0.34),rgba(8,12,22,0.82))]">
            <div className="flex flex-wrap items-center gap-2">
                <TagPill tone="primary">Action Brief</TagPill>
                <TagPill>{Math.round((brief.confidence || 0) * 100)}% confidence</TagPill>
            </div>

            <div>
                <p className="text-xs uppercase tracking-[0.14em] text-ink-muted">Now</p>
                <h3 className="mt-2 text-xl font-semibold text-white">{brief.headline}</h3>
                <p className="mt-2 text-sm leading-7 text-ink-secondary">{brief.pattern}</p>
            </div>

            {brief.whatHelpedBefore && (
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-ink-muted">What Helped Before</p>
                    <p className="mt-2 text-sm leading-7 text-white/90">{brief.whatHelpedBefore.summary}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                        <TagPill>{brief.whatHelpedBefore.reason}</TagPill>
                        {brief.whatHelpedBefore.entryId && openEntryHref && (
                            <Link
                                href={openEntryHref(brief.whatHelpedBefore.entryId)}
                                className="rounded-full border border-white/12 bg-white/[0.03] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-ink-secondary transition-colors hover:bg-white/[0.08] hover:text-white"
                            >
                                Open note
                            </Link>
                        )}
                    </div>
                </div>
            )}

            {brief.nextMove && (
                <div className="rounded-2xl border border-primary/20 bg-primary/10 p-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-ink-muted">One Move For Today</p>
                    <p className="mt-2 text-sm font-semibold text-white">{brief.nextMove.label}</p>
                    <p className="mt-2 text-sm leading-7 text-white/85">{brief.nextMove.description}</p>
                </div>
            )}

            {brief.reachOut && (
                <div className="rounded-2xl border border-amber-300/20 bg-amber-200/[0.06] p-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-ink-muted">Reach Out</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-white">{brief.reachOut.label}</p>
                        {brief.reachOut.channelLabel && <TagPill>{brief.reachOut.channelLabel}</TagPill>}
                        {brief.reachOut.relationship && <TagPill>{brief.reachOut.relationship}</TagPill>}
                    </div>
                    <p className="mt-2 text-sm leading-7 text-white/85">{brief.reachOut.rationale}</p>
                    {hasSupportContext && (
                        <div className={cn(
                            'mt-3 grid gap-3',
                            brief.reachOut.supportMemory && brief.reachOut.fallbackSupport ? 'lg:grid-cols-2' : 'grid-cols-1'
                        )}>
                            {brief.reachOut.supportMemory && (
                                <SupportMemoryCallout
                                    memory={brief.reachOut.supportMemory}
                                    title="Why This Person Is Visible"
                                />
                            )}
                            {brief.reachOut.fallbackSupport && (
                                <FallbackSupportCallout
                                    fallback={brief.reachOut.fallbackSupport}
                                    surface={surface}
                                    entryId={entryId || null}
                                />
                            )}
                        </div>
                    )}
                    {brief.reachOut.draftStarter && (
                        <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
                            <p className="text-[11px] uppercase tracking-[0.12em] text-ink-muted">What to say first</p>
                            <p className="mt-2 text-sm leading-7 text-white/90">{brief.reachOut.draftStarter}</p>
                        </div>
                    )}
                    {(brief.reachOut.contactActions || []).length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                            {(brief.reachOut.contactActions || []).map((action) => (
                                <a
                                    key={`${action.kind}-${action.href}`}
                                    href={action.href}
                                    className="rounded-full border border-amber-300/25 bg-amber-200/[0.08] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-white transition-colors hover:bg-amber-200/[0.14]"
                                >
                                    {action.label}
                                </a>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {brief.keep && (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-ink-muted">Keep</p>
                    <p className="mt-2 text-sm font-semibold text-white">{brief.keep.label}</p>
                    <p className="mt-2 text-sm leading-7 text-ink-secondary">{brief.keep.evidence}</p>
                </div>
            )}

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-ink-muted">Write About This Next</p>
                <p className="mt-2 text-sm leading-7 text-white/90">{brief.followUpPrompt}</p>
            </div>
        </AppPanel>
    );
}
