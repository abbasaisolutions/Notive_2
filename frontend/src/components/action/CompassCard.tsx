'use client';

import React from 'react';
import { cn } from '@/utils/cn';

export default function CompassCard({
    kicker,
    title,
    body,
    grounding,
    accent = 'default',
}: {
    kicker: string;
    title: string;
    body: string;
    grounding?: string;
    accent?: 'default' | 'primary' | 'support';
}) {
    const accentClass = accent === 'primary'
        ? 'border-primary/25 bg-[linear-gradient(145deg,rgba(58,96,210,0.18),rgba(8,12,22,0.78))]'
        : accent === 'support'
            ? 'border-amber-300/20 bg-[linear-gradient(145deg,rgba(153,104,34,0.18),rgba(8,12,22,0.78))]'
            : 'border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))]';
    const accentDotClass = accent === 'primary'
        ? 'bg-primary shadow-[0_0_18px_rgba(72,106,255,0.35)]'
        : accent === 'support'
            ? 'bg-amber-300 shadow-[0_0_18px_rgba(217,149,54,0.35)]'
            : 'bg-white/35 shadow-[0_0_14px_rgba(255,255,255,0.12)]';

    return (
        <div className={cn('signal-lines rounded-[1.6rem] border p-5 md:p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]', accentClass)}>
            <div className="flex items-center justify-between gap-3">
                <p className="text-xs uppercase tracking-[0.14em] text-ink-muted">{kicker}</p>
                <span className={cn('h-2.5 w-2.5 rounded-full', accentDotClass)} aria-hidden="true" />
            </div>
            <h3 className="mt-2 text-lg font-semibold text-white">{title}</h3>
            <p className="mt-3 text-sm leading-7 text-ink-secondary">{body}</p>
            {grounding && (
                <div className="mt-4 inline-flex max-w-full rounded-full border border-white/10 bg-black/20 px-3 py-1.5">
                    <p className="truncate text-xs uppercase tracking-[0.12em] text-ink-muted">{grounding}</p>
                </div>
            )}
        </div>
    );
}
