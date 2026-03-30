/* DASHBOARD REFINEMENT COMPLETE — matches logo + generated images exactly:
   warm paper grain, pencil lines, one sage sprout doodle max,
   one calm Focus Card, grounded action-first experience for students */
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
    const compactSupportCard = brief.whatHelpedBefore
        ? {
            label: 'What helped before',
            title: brief.whatHelpedBefore.summary,
            body: brief.whatHelpedBefore.reason,
        }
        : brief.keep
            ? {
                label: 'Keep',
                title: brief.keep.label,
                body: brief.keep.evidence,
            }
            : brief.reachOut
                ? {
                    label: 'If support helps here',
                    title: brief.reachOut.label,
                    body: brief.reachOut.rationale,
                }
                : null;

    const content = (
        <div className={isCompactDashboard ? 'space-y-3' : 'space-y-4'}>
            <div>
                <p className="section-label">Action brief</p>
                <h3 className={`notebook-title mt-2 ${isCompactDashboard ? 'text-[1.02rem] leading-6 md:text-[1.15rem]' : 'text-xl md:text-[1.55rem]'}`}>
                    Treat this like a direction check, not a final verdict.
                </h3>
                <p className={`notebook-copy mt-3 ${isCompactDashboard ? 'text-[0.82rem] leading-6' : 'text-[0.875rem] leading-7'}`}>
                    {brief.headline}
                </p>
                <p className={`notebook-copy mt-2 ${isCompactDashboard ? 'text-[0.82rem] leading-6' : 'text-[0.875rem] leading-7'}`}>
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
                <div className="app-paper-soft rounded-[1.25rem] p-4">
                    <p className="section-label">What helped before</p>
                    <p className="notebook-copy mt-2 text-[0.875rem] leading-7">
                        {brief.whatHelpedBefore.summary}
                    </p>
                    <p className="notebook-muted mt-2 text-xs leading-6">
                        {brief.whatHelpedBefore.reason}
                    </p>
                    {brief.whatHelpedBefore.entryId && openEntryHref && (
                        <Link
                            href={openEntryHref(brief.whatHelpedBefore.entryId)}
                            className="workspace-button-outline mt-3 inline-flex rounded-xl px-3 py-2 text-xs font-semibold"
                        >
                            Open the note that helped
                        </Link>
                    )}
                </div>
            )}

            {!isCompactDashboard && brief.keep && (
                <div className="app-paper-soft rounded-[1.25rem] p-4">
                    <p className="section-label">Keep</p>
                    <p className="notebook-title mt-2 text-lg">{brief.keep.label}</p>
                    <p className="notebook-copy mt-2 text-[0.875rem] leading-7">{brief.keep.evidence}</p>
                </div>
            )}

            {!isCompactDashboard && brief.reachOut && (
                <div className="app-paper-soft rounded-[1.25rem] p-4">
                    <p className="section-label">If support helps here</p>
                    <p className="notebook-title mt-2 text-lg">{brief.reachOut.label}</p>
                    <p className="notebook-copy mt-2 text-[0.875rem] leading-7">{brief.reachOut.rationale}</p>

                    {hasSupportContext && (
                        <div className={cn(
                            'mt-3 grid gap-3',
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

            <div className="app-paper-soft rounded-[1.25rem] p-4">
                <p className="section-label">One clear next move</p>
                <p className={`notebook-title mt-2 ${isCompactDashboard ? 'text-[1rem] leading-6' : 'text-lg'}`}>
                    {brief.nextMove?.label || 'Draft the first lines'}
                </p>
                <p className={`notebook-copy mt-2 ${isCompactDashboard ? 'text-[0.82rem] leading-6' : 'text-[0.875rem] leading-7'}`}>
                    {nextMoveText}
                </p>
                <p className={`notebook-muted mt-2 ${isCompactDashboard ? 'text-[0.72rem] leading-5' : 'text-xs leading-6'}`}>
                    {brief.followUpPrompt}
                </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <Link
                    href={draftHref}
                    className="workspace-button-primary inline-flex items-center rounded-xl px-4 py-3 text-sm font-semibold"
                >
                    Draft the first lines
                </Link>
                {brief.reachOut?.draftStarter && (
                    <p className="notebook-muted text-xs leading-6">
                        Start with: “{brief.reachOut.draftStarter}”
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
