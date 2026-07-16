'use client';

import type { ReactNode } from 'react';

type DisclosureSectionProps = {
    label: string;
    description: string;
    children: ReactNode;
    id?: string;
    className?: string;
};

/**
 * Collapsed-by-default dashboard section. Content stays out of the way until
 * the reader asks for it, and every section shares one summary treatment
 * instead of hand-rolled <details> markup per card.
 */
export default function DisclosureSection({
    label,
    description,
    children,
    id,
    className = 'border-[rgba(92,92,92,0.12)] bg-[rgba(255,255,255,0.38)]',
}: DisclosureSectionProps) {
    return (
        <details id={id} className={`group scroll-mt-24 rounded-card-125 border ${className}`}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3 [&::-webkit-details-marker]:hidden">
                <span>
                    <span className="section-label block">{label}</span>
                    <span className="mt-1 block text-[0.72rem] leading-5 text-[rgb(var(--text-soft))]">
                        {description}
                    </span>
                </span>
                <span className="text-[0.62rem] font-semibold uppercase tracking-[0.1em] text-[rgb(var(--text-soft))] group-open:hidden">
                    Open
                </span>
                <span className="hidden text-[0.62rem] font-semibold uppercase tracking-[0.1em] text-[rgb(var(--text-soft))] group-open:inline">
                    Hide
                </span>
            </summary>
            <div className="border-t border-[rgba(92,92,92,0.12)] px-3 pb-3 pt-3">
                {children}
            </div>
        </details>
    );
}
