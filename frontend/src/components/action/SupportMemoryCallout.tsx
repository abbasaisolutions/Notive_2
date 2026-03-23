'use client';

import React from 'react';
import { TagPill } from '@/components/ui/surface';
import { cn } from '@/utils/cn';
import type { StudentSupportMemory } from './types';

const formatDateLabel = (value: string | null | undefined) => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export default function SupportMemoryCallout({
    memory,
    title = 'Why This Person Is Showing Up',
    className,
}: {
    memory: StudentSupportMemory;
    title?: string;
    className?: string;
}) {
    const lastRecordedLabel = formatDateLabel(memory.lastRecordedAt);

    return (
        <div className={cn('rounded-[1.5rem] border border-emerald-300/20 bg-[linear-gradient(145deg,rgba(24,99,85,0.18),rgba(8,12,22,0.78))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]', className)}>
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-300 shadow-[0_0_18px_rgba(52,211,153,0.28)]" aria-hidden="true" />
                    <p className="text-xs uppercase tracking-[0.14em] text-ink-muted">{title}</p>
                </div>
                {lastRecordedLabel && <TagPill>{lastRecordedLabel}</TagPill>}
            </div>
            <p className="mt-2 text-sm leading-7 text-white/90">{memory.summary}</p>
            <div className="mt-3 flex flex-wrap gap-2">
                {memory.helpedCount > 0 && (
                    <TagPill tone="primary">
                        Helped {memory.helpedCount} time{memory.helpedCount === 1 ? '' : 's'}
                    </TagPill>
                )}
                {memory.stillNeedCount > 0 && (
                    <TagPill>
                        Backup needed {memory.stillNeedCount} time{memory.stillNeedCount === 1 ? '' : 's'}
                    </TagPill>
                )}
                {memory.lastOutcome && (
                    <TagPill>
                        {memory.lastOutcome === 'helped' ? 'Last check-in helped' : 'Last check-in needed backup'}
                    </TagPill>
                )}
            </div>
        </div>
    );
}
