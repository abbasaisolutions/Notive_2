/* Secondary support surface for turning a note into a practical follow-up. */
'use client';

import React from 'react';
import Link from 'next/link';
import { Surface } from '@/components/ui/surface';
import { cn } from '@/utils/cn';
import FallbackSupportCallout from './FallbackSupportCallout';
import SupportMemoryCallout from './SupportMemoryCallout';
import type { StudentActionBrief } from './types';

export default function ActionBriefPanel({
    brief,
    surface = 'guide',
    entryId,
    openEntryHref,
    draftHref = '/entry/new?mode=quick',
    embedded = false,
}: {
    brief: StudentActionBrief;
    surface?: 'dashboard' | 'guide' | 'entry' | 'safety';
    entryId?: string | null;
    openEntryHref?: (entryId: string) => string;
    draftHref?: string;
    embedded?: boolean;
}) {
    const hasSupportContext = Boolean(brief.reachOut?.supportMemory || brief.reachOut?.fallbackSupport);
    const nextMoveText = brief.nextMove?.description || brief.nextMove?.label || brief.followUpPrompt;
    const isCompactDashboard = embedded && surface === 'dashboard';
    const isEntry = surface === 'entry';
    const compactSupportCard = brief.whatHelpedBefore
        ? {
            label: 'Helpful context',
            title: brief.whatHelpedBefore.summary,
            body: brief.whatHelpedBefore.reason,
        }
        : brief.keep
            ? {
                label: 'What to keep',
                title: brief.keep.label,
                body: brief.keep.evidence,
            }
            : brief.reachOut
                ? {
                    label: 'If reaching out helps',
                    title: brief.reachOut.label,
                    body: brief.reachOut.rationale,
                }
                : null;

    const cardPad = isEntry ? 'rounded-xl p-3' : 'rounded-[1.25rem] p-4';

    const content = (
        <div className={isCompactDashboard || isEntry ? 'space-y-2.5' : 'space-y-4'}>
            <div>
                <p className="section-label">Use this note</p>
                <h3 className={`notebook-title italic mt-1.5 ${isCompactDashboard ? 'text-[1.02rem] leading-6 md:text-[1.15rem]' : isEntry ? 'text-[0.95rem] leading-5' : 'text-xl md:text-[1.55rem]'}`}>
                    {brief.headline}
                </h3>
                <p className={`notebook-copy italic mt-1 ${isCompactDashboard ? 'text-[0.82rem] leading-6' : isEntry ? 'text-[0.75rem] leading-5' : 'text-[0.875rem] leading-7'}`}>
                    {brief.pattern}
                </p>
            </div>

            {isCompactDashboard && compactSupportCard && (
                <div className="app-paper-soft rounded-[1.25rem] p-4">
                    <p className="section-label">{compactSupportCard.label}</p>
                    <p className="notebook-title mt-2 text-[0.96rem] leading-6">{compactSupportCard.title}</p>
                    <p className="notebook-copy mt-2 text-[0.8rem] leading-6">{compactSupportCard.body}</p>
                </div>
            )}

            {!isCompactDashboard && brief.whatHelpedBefore && (
                <div className={`app-paper-soft ${cardPad}`}>
                    <p className="section-label">Helpful context</p>
                    <p className={`notebook-copy mt-1.5 ${isEntry ? 'text-[0.78rem] leading-5' : 'text-[0.875rem] leading-7'}`}>
                        {brief.whatHelpedBefore.summary}
                    </p>
                    <p className={`notebook-muted mt-1 ${isEntry ? 'text-[0.7rem] leading-4' : 'text-xs leading-6'}`}>
                        {brief.whatHelpedBefore.reason}
                    </p>
                    {brief.whatHelpedBefore.entryId && openEntryHref && (
                        <Link
                            href={openEntryHref(brief.whatHelpedBefore.entryId)}
                            className="workspace-button-outline mt-2 inline-flex rounded-xl px-3 py-1.5 text-xs font-semibold"
                        >
                            Open the note that helped
                        </Link>
                    )}
                </div>
            )}

            {!isCompactDashboard && brief.keep && (
                <div className={`app-paper-soft ${cardPad}`}>
                    <p className="section-label">Keep</p>
                    <p className={`notebook-title mt-1.5 ${isEntry ? 'text-[0.82rem] leading-5' : 'text-lg'}`}>{brief.keep.label}</p>
                    <p className={`notebook-copy mt-1 ${isEntry ? 'text-[0.75rem] leading-5' : 'text-[0.875rem] leading-7'}`}>{brief.keep.evidence}</p>
                </div>
            )}

            {!isCompactDashboard && brief.reachOut && (
                <div className={`app-paper-soft ${cardPad}`}>
                    <p className="section-label">If reaching out helps</p>
                    <p className={`notebook-title mt-1.5 ${isEntry ? 'text-[0.82rem] leading-5' : 'text-lg'}`}>{brief.reachOut.label}</p>
                    <p className={`notebook-copy mt-1 ${isEntry ? 'text-[0.75rem] leading-5' : 'text-[0.875rem] leading-7'}`}>{brief.reachOut.rationale}</p>

                    {hasSupportContext && (
                        <div className={cn(
                            'mt-2.5 grid gap-2.5',
                            brief.reachOut.supportMemory && brief.reachOut.fallbackSupport ? 'lg:grid-cols-2' : 'grid-cols-1'
                        )}>
                            {brief.reachOut.supportMemory && (
                                <SupportMemoryCallout
                                    memory={brief.reachOut.supportMemory}
                                    title="Why this person is visible"
                                    variant="notebook"
                                />
                            )}
                            {brief.reachOut.fallbackSupport && (
                                <FallbackSupportCallout
                                    fallback={brief.reachOut.fallbackSupport}
                                    surface={surface}
                                    entryId={entryId || null}
                                    variant="notebook"
                                />
                            )}
                        </div>
                    )}
                </div>
            )}

            <div className={`app-paper-soft ${cardPad}`}>
                <p className="section-label">Suggested use</p>
                <p className={`notebook-title italic mt-1.5 ${isCompactDashboard ? 'text-[1rem] leading-6' : isEntry ? 'text-[0.82rem] leading-5' : 'text-lg'}`}>
                    {brief.nextMove?.label || 'Start a draft'}
                </p>
                {nextMoveText && nextMoveText !== brief.nextMove?.label && (
                    <p className={`notebook-copy mt-1 ${isCompactDashboard ? 'text-[0.82rem] leading-6' : isEntry ? 'text-[0.75rem] leading-5' : 'text-[0.875rem] leading-7'}`}>
                        {nextMoveText}
                    </p>
                )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <Link
                    href={draftHref}
                    className={`workspace-button-primary inline-flex items-center rounded-xl font-semibold ${isEntry ? 'px-3 py-1.5 text-xs' : 'px-4 py-3 text-sm'}`}
                >
                    Start a draft
                </Link>
                {brief.reachOut?.draftStarter && (
                    <p className="notebook-muted text-xs leading-5">
                        Start with: &ldquo;{brief.reachOut.draftStarter}&rdquo;
                    </p>
                )}
            </div>
        </div>
    );

    if (embedded) {
        return content;
    }

    return (
        <Surface doodle="sprout" doodleAccent="sage" className="app-paper space-y-4">
            {content}
        </Surface>
    );
}
