'use client';

import { useMemo } from 'react';
import Link from 'next/link';

type LifeAreaCounts = Record<string, number>;

const LIFE_AREA_EMOJI: Record<string, string> = {
    'health & wellness': '🌱',
    'relationships': '💞',
    'family': '🏠',
    'mindset': '🧠',
    'creativity': '🎨',
    'lifestyle': '☕',
    'career': '💼',
    'business': '📈',
    'leadership': '🧭',
    'learning': '📚',
    'execution': '⚙️',
    'networking': '🤝',
};

type LifeAreaBreakdownProps = {
    /** lifeAreaCounts as returned by GET /entries facets — keyed by canonical area name. */
    counts: LifeAreaCounts;
};

/**
 * Surfaces the user's lifeArea entry-count distribution so the dashboard
 * exposes that signal directly (it's persisted at save time but, prior to
 * this card, the user had no way to navigate by it). Controlled component:
 * the dashboard already loads /entries on mount, so we receive counts via
 * props instead of issuing a duplicate request.
 */
export default function LifeAreaBreakdown({ counts }: LifeAreaBreakdownProps) {
    const ordered = useMemo(() => {
        const entries = Object.entries(counts).filter(([, count]) => count > 0);
        entries.sort((a, b) => b[1] - a[1]);
        return entries;
    }, [counts]);

    if (ordered.length === 0) return null;

    const max = ordered[0]?.[1] || 1;

    return (
        <section
            aria-labelledby="life-area-breakdown-heading"
            className="workspace-panel mt-6 rounded-2xl p-5"
        >
            <header className="mb-3 flex items-center justify-between gap-3">
                <div>
                    <p className="type-overline text-muted">Browse</p>
                    <h2 id="life-area-breakdown-heading" className="workspace-heading mt-1 text-base font-semibold">
                        By life area
                    </h2>
                </div>
                <p className="text-xs text-ink-muted">{ordered.length} {ordered.length === 1 ? 'area' : 'areas'}</p>
            </header>

            <ul className="space-y-2">
                {ordered.map(([area, count]) => {
                    const ratio = count / max;
                    const emoji = LIFE_AREA_EMOJI[area.toLowerCase()] || '✦';
                    return (
                        <li key={area}>
                            <Link
                                href={`/timeline?lifeArea=${encodeURIComponent(area)}`}
                                className="group block rounded-xl border border-transparent px-3 py-2 transition-colors hover:border-[rgba(var(--paper-border),0.65)] hover:bg-[rgba(var(--paper-sage),0.06)]"
                            >
                                <div className="flex items-center gap-3">
                                    <span aria-hidden="true" className="text-lg">{emoji}</span>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-baseline justify-between gap-2">
                                            <span className="text-sm font-medium text-strong group-hover:text-primary">
                                                {area}
                                            </span>
                                            <span className="text-xs text-ink-muted">{count}</span>
                                        </div>
                                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[rgba(var(--paper-ink),0.06)]">
                                            <div
                                                className="h-full rounded-full bg-[rgb(var(--paper-sage))]"
                                                style={{ width: `${Math.max(8, ratio * 100)}%` }}
                                                aria-hidden="true"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}
