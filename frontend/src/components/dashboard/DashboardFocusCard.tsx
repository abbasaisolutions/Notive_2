'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { cn } from '@/utils/cn';
import {
    NotebookDoodle,
    type NotebookAccentName,
    type NotebookDoodleName,
} from '@/components/dashboard/NotebookDoodles';

type FocusAction = {
    label: string;
    href?: string;
    onClick?: () => void;
    type?: 'button';
    tone?: 'primary' | 'secondary';
};

type FocusPanel = {
    label: string;
    value: string;
};

const accentConfig: Record<NotebookAccentName, { line: string; wash: string; dot: string }> = {
    sage: {
        line: 'bg-[rgba(199,220,203,0.95)]',
        wash: 'bg-[rgba(199,220,203,0.18)]',
        dot: 'bg-[rgba(199,220,203,1)]',
    },
    lilac: {
        line: 'bg-[rgba(216,199,232,0.95)]',
        wash: 'bg-[rgba(216,199,232,0.18)]',
        dot: 'bg-[rgba(216,199,232,1)]',
    },
    apricot: {
        line: 'bg-[rgba(240,205,184,0.95)]',
        wash: 'bg-[rgba(240,205,184,0.18)]',
        dot: 'bg-[rgba(240,205,184,1)]',
    },
    sky: {
        line: 'bg-[rgba(191,214,221,0.95)]',
        wash: 'bg-[rgba(191,214,221,0.18)]',
        dot: 'bg-[rgba(191,214,221,1)]',
    },
    amber: {
        line: 'bg-[rgba(234,216,189,0.95)]',
        wash: 'bg-[rgba(234,216,189,0.2)]',
        dot: 'bg-[rgba(234,216,189,1)]',
    },
};

function FocusActionButton({
    action,
    subtle = false,
}: {
    action: FocusAction;
    subtle?: boolean;
}) {
    const className = cn(
        subtle
            ? 'notebook-tertiary-cta inline-flex items-center gap-1 transition-colors'
            : 'inline-flex items-center justify-center rounded-[1rem] px-4 py-3 text-sm font-semibold transition-colors',
        subtle ? '' : action.tone === 'secondary' ? 'notebook-secondary-cta' : 'notebook-primary-cta'
    );

    if (action.type === 'button' || (!action.href && action.onClick)) {
        return (
            <button type="button" onClick={action.onClick} className={className}>
                {action.label}
            </button>
        );
    }

    if (action.href) {
        const isInternal = action.href.startsWith('/');
        if (isInternal) {
            return (
                <Link href={action.href} onClick={action.onClick} className={className}>
                    {action.label}
                </Link>
            );
        }

        return (
            <a href={action.href} onClick={action.onClick} className={className}>
                {action.label}
            </a>
        );
    }

    return null;
}

export default function DashboardFocusCard({
    eyebrow,
    title,
    body,
    evidence,
    evidenceFallback,
    panels = [],
    primaryAction,
    secondaryAction,
    accent = 'sage',
    doodle,
    className,
}: {
    eyebrow: string;
    title: string;
    body: string;
    evidence?: string | null;
    evidenceFallback?: string | null;
    panels?: FocusPanel[];
    primaryAction?: FocusAction | null;
    secondaryAction?: FocusAction | null;
    accent?: NotebookAccentName;
    doodle?: NotebookDoodleName | null;
    className?: string;
}) {
    const accentStyles = accentConfig[accent];
    const visiblePanels = panels.filter((panel) => panel.value.trim()).slice(0, 2);
    const resolvedEvidence = evidence?.trim() || evidenceFallback?.trim() || '';

    return (
        <motion.section
            initial={{ opacity: 0, y: 12, rotate: -0.3 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
                'notebook-card notebook-focus-shadow relative overflow-hidden rounded-[2rem] p-6 md:p-7',
                className
            )}
        >
            <div className={cn('absolute inset-y-0 left-0 w-2 rounded-full', accentStyles.line)} aria-hidden="true" />
            <div className={cn('absolute right-6 top-6 rounded-full blur-2xl', accentStyles.wash, doodle ? 'h-24 w-24' : 'h-16 w-16')} aria-hidden="true" />

            <div className="relative flex flex-col gap-6">
                <div className="flex items-start justify-between gap-6">
                    <div className="min-w-0">
                        <div className="flex items-center gap-3">
                            <span className={cn('h-2.5 w-2.5 rounded-full', accentStyles.dot)} aria-hidden="true" />
                            <p className="section-label">{eyebrow}</p>
                        </div>
                        <motion.div
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: 1 }}
                            transition={{ delay: 0.08, duration: 0.28 }}
                            className={cn('mt-3 h-[3px] w-28 origin-left rounded-full', accentStyles.line)}
                        />
                    </div>

                    {doodle && (
                        <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.14, duration: 0.24 }}
                            className="shrink-0"
                        >
                            <NotebookDoodle name={doodle} accent={accent} />
                        </motion.div>
                    )}
                </div>

                <div className="max-w-3xl">
                    <h2 className="notebook-title text-[1.22rem] leading-[1.18] md:text-[1.34rem]">{title}</h2>
                    <p
                        className="notebook-copy mt-3 max-w-2xl text-base leading-7 md:text-[1.05rem]"
                        style={{ color: 'rgb(var(--paper-ink-soft))' }}
                    >
                        {body}
                    </p>
                </div>

                {resolvedEvidence && (
                    <p
                        className="notebook-muted max-w-3xl text-[0.95rem] leading-6"
                        style={{ color: 'rgb(155 143 120)' }}
                    >
                        {resolvedEvidence}
                    </p>
                )}

                {visiblePanels.length > 0 && (
                    <div className={cn('grid gap-3', visiblePanels.length === 1 ? 'md:grid-cols-1' : 'md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]')}>
                        {visiblePanels.map((panel) => (
                            <div key={`${panel.label}-${panel.value}`} className="notebook-card-soft min-w-0 overflow-hidden rounded-[1.55rem] p-4">
                                <p className="section-label">{panel.label}</p>
                                <p className="notebook-title mt-2 break-words text-lg leading-7">{panel.value}</p>
                            </div>
                        ))}
                    </div>
                )}

                {(primaryAction || secondaryAction) && (
                    <div className="flex flex-col gap-2">
                        {primaryAction && (
                            <div className="flex flex-wrap gap-3">
                                <FocusActionButton action={{ ...primaryAction, tone: primaryAction.tone || 'primary' }} />
                            </div>
                        )}
                        {secondaryAction && (
                            <div>
                                <FocusActionButton action={{ ...secondaryAction, tone: secondaryAction.tone || 'secondary' }} subtle />
                            </div>
                        )}
                    </div>
                )}
            </div>
        </motion.section>
    );
}
