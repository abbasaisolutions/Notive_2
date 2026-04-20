'use client';

import { FiArrowDown } from 'react-icons/fi';
import { Spinner } from '@/components/ui';

type PullToRefreshIndicatorProps = {
    pullDistance: number;
    progress: number;
    isReady: boolean;
    isRefreshing: boolean;
};

export default function PullToRefreshIndicator({
    pullDistance,
    progress,
    isReady,
    isRefreshing,
}: PullToRefreshIndicatorProps) {
    if (!isRefreshing && pullDistance <= 0) {
        return null;
    }

    const indicatorOffset = Math.max(-64 + Math.min(pullDistance, 72), -8);

    return (
        <div className="pointer-events-none fixed inset-x-0 top-0 z-[85] flex justify-center">
            <div
                className="rounded-full border border-[rgba(var(--paper-border),0.92)] bg-[rgba(255,251,245,0.94)] px-4 py-2 shadow-[0_8px_24px_rgba(92,92,92,0.12)] backdrop-blur-md"
                style={{
                    transform: `translateY(${indicatorOffset}px)`,
                    opacity: isRefreshing ? 1 : Math.max(0.28, progress),
                }}
                aria-live="polite"
            >
                <div className="flex items-center gap-2 text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-[rgb(var(--paper-ink-soft))]">
                    {isRefreshing ? (
                        <Spinner size="sm" />
                    ) : (
                        <FiArrowDown
                            className={`h-4 w-4 transition-transform duration-150 ${isReady ? 'rotate-180' : ''}`}
                            aria-hidden="true"
                        />
                    )}
                    <span>{isRefreshing ? 'Refreshing' : isReady ? 'Release to refresh' : 'Pull to refresh'}</span>
                </div>
            </div>
        </div>
    );
}
