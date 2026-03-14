'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { getRouteMeta } from '@/components/layout/nav-config';
import {
    FiActivity,
    FiCheckCircle,
    FiDownload,
    FiFileText,
    FiFilter,
    FiMinus,
    FiTrendingUp,
    FiUser,
} from 'react-icons/fi';

type SignalVisual = {
    icon: ReactNode;
    tone: string;
    label: string;
    detail: string;
};

const inferSignalVisual = (value: string): SignalVisual => {
    const text = value.toLowerCase();

    if (text.includes('trend') || text.includes('pattern')) {
        return {
            icon: <FiTrendingUp size={14} aria-hidden="true" />,
            tone: 'text-white border-white/15 bg-white/[0.04]',
            label: 'Trends',
            detail: value,
        };
    }

    if (text.includes('entry') || text.includes('feed')) {
        return {
            icon: <FiFileText size={14} aria-hidden="true" />,
            tone: 'text-zinc-200 border-zinc-400/30 bg-zinc-500/12',
            label: 'Entries',
            detail: value,
        };
    }

    if (text.includes('action') || text.includes('follow')) {
        return {
            icon: <FiCheckCircle size={14} aria-hidden="true" />,
            tone: 'text-neutral-200 border-neutral-400/30 bg-neutral-500/12',
            label: 'Next Step',
            detail: value,
        };
    }

    if (text.includes('profile') || text.includes('identity') || text.includes('privacy')) {
        return {
            icon: <FiUser size={14} aria-hidden="true" />,
            tone: 'text-stone-200 border-stone-400/30 bg-stone-500/12',
            label: 'Profile',
            detail: value,
        };
    }

    if (text.includes('streak') || text.includes('momentum')) {
        return {
            icon: <FiActivity size={14} aria-hidden="true" />,
            tone: 'text-white border-white/15 bg-white/[0.03]',
            label: 'Momentum',
            detail: value,
        };
    }

    if (text.includes('filter') || text.includes('control')) {
        return {
            icon: <FiFilter size={14} aria-hidden="true" />,
            tone: 'text-zinc-100 border-zinc-300/25 bg-zinc-500/10',
            label: 'Controls',
            detail: value,
        };
    }

    if (text.includes('evidence') || text.includes('export')) {
        return {
            icon: <FiDownload size={14} aria-hidden="true" />,
            tone: 'text-neutral-100 border-neutral-300/25 bg-neutral-500/10',
            label: 'Output',
            detail: value,
        };
    }

    return {
        icon: <FiMinus size={14} aria-hidden="true" />,
        tone: 'text-ink-secondary border-white/15 bg-white/[0.04]',
        label: value,
        detail: value,
    };
};

export default function PageInfoChecklist() {
    const pathname = usePathname();
    const routeMeta = getRouteMeta(pathname);
    const [showDetails, setShowDetails] = useState(false);

    useEffect(() => {
        setShowDetails(false);
    }, [pathname]);

    const visuals = useMemo(
        () => (routeMeta?.visibleInfo || []).map(inferSignalVisual),
        [routeMeta?.visibleInfo]
    );

    if (!routeMeta || visuals.length === 0) return null;

    return (
        <section className="px-4 pt-3 md:px-8" aria-label="Page visibility checklist">
            <div className="mx-auto max-w-6xl rounded-2xl border border-white/10 bg-surface-2/20 px-4 py-3 md:px-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                        <p className="text-xs uppercase tracking-[0.16em] text-ink-muted">Signal Check</p>
                        <p className="text-xs text-ink-secondary">Quick visual cues to confirm this page is complete.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {routeMeta.secondaryAction && (
                            <Link
                                href={routeMeta.secondaryAction.href}
                                className="rounded-lg border border-white/15 bg-white/[0.03] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-ink-secondary hover:text-white hover:bg-white/10 transition-colors"
                            >
                                {routeMeta.secondaryAction.shortLabel || routeMeta.secondaryAction.label}
                            </Link>
                        )}
                        {routeMeta.primaryAction && (
                            <Link
                                href={routeMeta.primaryAction.href}
                                className="rounded-lg border border-primary/30 bg-primary/12 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-primary hover:bg-primary/22 transition-colors"
                            >
                                {routeMeta.primaryAction.shortLabel || routeMeta.primaryAction.label}
                            </Link>
                        )}
                        <button
                            type="button"
                            onClick={() => setShowDetails((prev) => !prev)}
                            aria-expanded={showDetails}
                            className="rounded-lg border border-white/15 bg-white/[0.03] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-ink-secondary hover:text-white hover:bg-white/10 transition-colors"
                        >
                            {showDetails ? 'Less' : 'Details'}
                        </button>
                    </div>
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    {visuals.map((item, index) => (
                        <div
                            key={`${item.detail}-${index}`}
                            className={`rounded-xl border px-3 py-2 text-xs ${item.tone}`}
                        >
                            <div className="flex items-center gap-2">
                                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/20">{item.icon}</span>
                                <span className="font-semibold uppercase tracking-[0.08em] text-xs">{item.label}</span>
                            </div>
                            {showDetails && (
                                <p className="mt-2 text-xs leading-relaxed opacity-90">{item.detail}</p>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

