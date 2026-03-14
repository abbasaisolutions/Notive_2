'use client';

import React from 'react';
import Link from 'next/link';
import { cn } from '@/utils/cn';

type AppPanelTone = 'default' | 'soft' | 'accent';
type StatTileTone = 'default' | 'primary' | 'subtle';
type TagTone = 'default' | 'primary' | 'muted';

const panelToneClasses: Record<AppPanelTone, string> = {
    default: 'glass-card border border-white/10',
    soft: 'rounded-2xl border border-white/10 bg-white/[0.03]',
    accent: 'rounded-2xl border border-primary/30 bg-primary/12',
};

const statToneClasses: Record<StatTileTone, string> = {
    default: 'border-white/10 bg-white/[0.03] text-white',
    primary: 'border-primary/30 bg-primary/12 text-white',
    subtle: 'border-white/15 bg-black/20 text-ink-secondary',
};

const tagToneClasses: Record<TagTone, string> = {
    default: 'border-white/15 bg-white/[0.03] text-ink-secondary',
    primary: 'border-primary/30 bg-primary/12 text-primary',
    muted: 'border-white/10 bg-black/20 text-ink-muted',
};

export function AppPanel({
    children,
    className,
    tone = 'default',
    ...props
}: React.HTMLAttributes<HTMLElement> & {
    children: React.ReactNode;
    tone?: AppPanelTone;
}) {
    return (
        <section
            className={cn('rounded-2xl p-5 md:p-6', panelToneClasses[tone], className)}
            {...props}
        >
            {children}
        </section>
    );
}

export function SectionHeader({
    title,
    description,
    kicker,
    actionLabel,
    actionHref,
    className,
}: {
    title: string;
    description?: string;
    kicker?: string;
    actionLabel?: string;
    actionHref?: string;
    className?: string;
}) {
    return (
        <div className={cn('flex flex-wrap items-start justify-between gap-3', className)}>
            <div>
                {kicker && <p className="text-xs uppercase tracking-[0.14em] text-ink-muted mb-1">{kicker}</p>}
                <h2 className="text-xl md:text-2xl font-semibold text-white">{title}</h2>
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
            <p className="mt-1 text-lg font-semibold text-white">{value}</p>
            {hint && <p className="mt-1 text-[12px] text-ink-secondary">{hint}</p>}
        </div>
    );
}

export function TagPill({
    children,
    tone = 'default',
    className,
}: {
    children: React.ReactNode;
    tone?: TagTone;
    className?: string;
}) {
    return (
        <span className={cn('inline-flex items-center rounded-full border px-2.5 py-1 text-xs uppercase tracking-[0.1em]', tagToneClasses[tone], className)}>
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
        <div className={cn('flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-2', className)}>
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
            <h3 className="text-xl font-semibold text-white">{title}</h3>
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


