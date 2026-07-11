'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSavedDraft } from '@/hooks/use-entry-draft';
import { readPortfolioSession } from '@/utils/portfolio-session';

type ContinueWorkspaceCardProps = {
    userId: string | null | undefined;
    entryHref: string;
    portfolioHref: string;
};

type ContinueItem = {
    label: string;
    detail: string;
    href: string;
};

const portfolioLabel = (type: 'resume' | 'statement' | 'interview' | 'growth') => ({
    resume: 'resume',
    statement: 'statement',
    interview: 'interview prep',
    growth: 'growth review',
}[type]);

export default function ContinueWorkspaceCard({ userId, entryHref, portfolioHref }: ContinueWorkspaceCardProps) {
    const [item, setItem] = useState<ContinueItem | null>(null);

    useEffect(() => {
        const draft = getSavedDraft(userId);
        const portfolioSession = readPortfolioSession();
        const portfolioUpdatedAt = portfolioSession ? new Date(portfolioSession.updatedAt).getTime() : 0;
        const draftUpdatedAt = draft?.updatedAt || 0;

        if (draft && draftUpdatedAt >= portfolioUpdatedAt) {
            const wordCount = draft.content.trim() ? draft.content.trim().split(/\s+/).length : 0;
            setItem({
                label: 'Continue writing',
                detail: draft.title.trim() || (draft.audioUrl ? 'Voice note draft' : `${wordCount} word${wordCount === 1 ? '' : 's'} saved`),
                href: entryHref,
            });
            return;
        }

        if (portfolioSession) {
            setItem({
                label: 'Continue your portfolio',
                detail: `Return to your ${portfolioLabel(portfolioSession.selectedExportType)}`,
                href: portfolioHref,
            });
            return;
        }

        setItem(null);
    }, [entryHref, portfolioHref, userId]);

    if (!item) return null;

    return (
        <Link
            href={item.href}
            className="block rounded-[1.1rem] border border-[rgba(126,157,149,0.32)] bg-[rgba(255,255,255,0.58)] px-4 py-3 transition-colors hover:bg-[rgba(255,255,255,0.76)]"
        >
            <div className="flex items-center justify-between gap-3">
                <span className="min-w-0">
                    <span className="section-label block">Continue</span>
                    <span className="mt-1 block truncate text-sm font-semibold text-[rgb(var(--paper-ink))]">{item.label}</span>
                    <span className="mt-0.5 block truncate text-xs text-[rgb(var(--paper-ink-soft))]">{item.detail}</span>
                </span>
                <span className="shrink-0 text-sm font-semibold text-[rgb(var(--paper-sage))]" aria-hidden="true">Open</span>
            </div>
        </Link>
    );
}