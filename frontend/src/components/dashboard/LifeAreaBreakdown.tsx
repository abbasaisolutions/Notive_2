'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import useApi from '@/hooks/use-api';
import { API_URL } from '@/constants/config';

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

/**
 * Surfaces the user's lifeArea entry-count distribution so the dashboard
 * exposes that signal directly (it's persisted at save time but, prior to
 * this card, the user had no way to navigate by it).
 */
export default function LifeAreaBreakdown() {
    const { apiFetch } = useApi();
    const [counts, setCounts] = useState<LifeAreaCounts | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await apiFetch(`${API_URL}/entries?limit=1`);
                if (!res.ok) return;
                const data = await res.json();
                const facetCounts = (data?.facets?.lifeAreaCounts as LifeAreaCounts | undefined) || null;
                if (!cancelled) setCounts(facetCounts);
            } catch {
                // silent — non-critical card
            }
        })();
        return () => { cancelled = true; };
    }, [apiFetch]);

    const ordered = useMemo(() => {
        if (!counts) return null;
        const entries = Object.entries(counts).filter(([, count]) => count > 0);
        entries.sort((a, b) => b[1] - a[1]);
        return entries;
    }, [counts]);

    if (!ordered || ordered.length === 0) return null;

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
