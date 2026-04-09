'use client';

import React from 'react';
import Link from 'next/link';
import { cn } from '@/utils/cn';
import {
    NotebookDoodle,
    type NotebookAccentName,
    type NotebookDoodleName,
} from '@/components/dashboard/NotebookDoodles';

type AppPanelTone = 'default' | 'soft' | 'accent';
type StatTileTone = 'default' | 'primary' | 'subtle';
type TagTone = 'default' | 'primary' | 'muted';

const panelToneClasses: Record<AppPanelTone, string> = {
    default: 'workspace-panel',
    soft: 'workspace-soft-panel rounded-2xl',
    accent: 'rounded-2xl border border-primary/30 bg-primary/12',
};

const statToneClasses: Record<StatTileTone, string> = {
    default: 'workspace-soft-panel text-[rgb(var(--text-primary))]',
    primary: 'border-primary/30 bg-primary/12 text-[rgb(var(--text-primary))]',
    subtle: 'workspace-muted-panel text-ink-secondary',
};

const tagToneClasses: Record<TagTone, string> = {
    default: 'workspace-pill text-ink-secondary',
    primary: 'border-primary/30 bg-primary/12 text-primary',
    muted: 'workspace-pill-muted text-ink-muted',
};

export function AppPanel({
    children,
    className,
    tone = 'default',
    doodle,
    doodleAccent = 'sage',
    doodleClassName,
    ...props
}: React.HTMLAttributes<HTMLElement> & {
    children: React.ReactNode;
    tone?: AppPanelTone;
    doodle?: NotebookDoodleName;
    doodleAccent?: NotebookAccentName;
    doodleClassName?: string;
}) {
    const usesPaperSurface = className?.includes('app-paper');

    return (
        <section
            className={cn(
                'relative overflow-hidden rounded-2xl p-5 md:p-6',
                !usesPaperSurface && panelToneClasses[tone],
                className
            )}
            {...props}
        >
            {doodle && (
                <div className={cn('pointer-events-none absolute right-4 top-4 sprout-accent opacity-80', doodleClassName)}>
                    <NotebookDoodle name={doodle} accent={doodleAccent} />
                </div>
            )}
            <div className={cn('relative', doodle && 'pr-10')}>
                {children}
            </div>
        </section>
    );
}

export function Surface(
    props: React.HTMLAttributes<HTMLElement> & {
        children: React.ReactNode;
        tone?: AppPanelTone;
        doodle?: NotebookDoodleName;
        doodleAccent?: NotebookAccentName;
        doodleClassName?: string;
    }
) {
    return <AppPanel {...props} />;
}

export function SectionHeader({
    title,
    description,
    kicker,
    actionLabel,
    actionHref,
    className,
    as: Heading = 'h2',
}: {
    title: string;
    description?: string;
    kicker?: string;
    actionLabel?: string;
    actionHref?: string;
    className?: string;
    as?: 'h1' | 'h2' | 'h3';
}) {
    return (
        <div className={cn('flex flex-wrap items-start justify-between gap-3', className)}>
            <div>
                {kicker && <p className="text-xs uppercase tracking-[0.14em] text-ink-muted mb-1">{kicker}</p>}
                <Heading className="workspace-heading text-xl md:text-2xl font-semibold">{title}</Heading>
                {description && <p className="text-sm text-ink-secondary mt-1">{description}</p>}
            </div>
            {actionLabel && actionHref && (
                <Link
                    href={actionHref}
                    className="rounded-xl border border-primary/30 bg-primary/12 px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-primary hover:bg-primary/20 transition-colors"
                >
                    {actionLabel}
                </Link>
            )}
        </div>
    );
}

export function StatTile({
    label,
    value,
    hint,
    tone = 'default',
    className,
}: {
    label: string;
    value: React.ReactNode;
    hint?: string;
    tone?: StatTileTone;
    className?: string;
}) {
    return (
        <div className={cn('rounded-xl border px-3 py-2', statToneClasses[tone], className)}>
            <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">{label}</p>
            <p className="workspace-heading mt-1 text-lg font-semibold">{value}</p>
            {hint && <p className="mt-1 text-[12px] text-ink-secondary">{hint}</p>}
        </div>
    );
}

export function TagPill({
    children,
    tone = 'default',
    className,
    title,
}: {
    children: React.ReactNode;
    tone?: TagTone;
    className?: string;
    title?: string;
}) {
    return (
        <span title={title} className={cn('inline-flex items-center rounded-full border px-2.5 py-1 text-xs uppercase tracking-[0.1em]', tagToneClasses[tone], className)}>
            {children}
        </span>
    );
}

export function ActionBar({
    children,
    className,
}: {
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <div className={cn('workspace-actionbar flex flex-wrap items-center gap-2 rounded-xl p-2', className)}>
            {children}
        </div>
    );
}

export function EmptyState({
    title,
    description,
    actionLabel,
    actionHref,
    className,
}: {
    title: string;
    description: string;
    actionLabel?: string;
    actionHref?: string;
    className?: string;
}) {
    return (
        <AppPanel className={cn('text-center', className)} tone="soft">
            <h3 className="workspace-heading text-xl font-semibold">{title}</h3>
            <p className="text-sm text-ink-secondary mt-2">{description}</p>
            {actionLabel && actionHref && (
                <Link
                    href={actionHref}
                    className="mt-4 inline-flex items-center rounded-xl border border-primary/30 bg-primary/12 px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-primary hover:bg-primary/20 transition-colors"
                >
                    {actionLabel}
                </Link>
            )}
        </AppPanel>
    );
}


