import { useEffect, useRef, useState } from 'react';
import { hapticTap, hapticSuccess } from '@/services/haptics.service';

type UsePullToRefreshOptions = {
    enabled?: boolean;
    onRefresh: () => Promise<void> | void;
    threshold?: number;
    maxDistance?: number;
};

type UsePullToRefreshResult = {
    isRefreshing: boolean;
    pullDistance: number;
    progress: number;
    isReady: boolean;
};

const INTERACTIVE_SELECTOR = [
    'a',
    'button',
    'input',
    'textarea',
    'select',
    'summary',
    '[contenteditable="true"]',
    '[data-no-pull-refresh="true"]',
    '[role="button"]',
    '[role="dialog"]',
].join(', ');

export default function usePullToRefresh({
    enabled = true,
    onRefresh,
    threshold = 76,
    maxDistance = 120,
}: UsePullToRefreshOptions): UsePullToRefreshResult {
    const [pullDistance, setPullDistance] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const pullDistanceRef = useRef(0);
    const isRefreshingRef = useRef(false);

    useEffect(() => {
        isRefreshingRef.current = isRefreshing;
    }, [isRefreshing]);

    useEffect(() => {
        if (!enabled || typeof window === 'undefined') {
            return;
        }

        const pointerQuery = window.matchMedia('(pointer: coarse)');
        if (!pointerQuery.matches) {
            return;
        }

        let animationFrame = 0;
        let startY = 0;
        let isDragging = false;
        let disposed = false;
        let hasCrossedThreshold = false;

        const setDistance = (nextDistance: number) => {
            pullDistanceRef.current = nextDistance;

            if (animationFrame) {
                window.cancelAnimationFrame(animationFrame);
            }

            animationFrame = window.requestAnimationFrame(() => {
                animationFrame = 0;
                setPullDistance(nextDistance);
            });
        };

        const resetPull = () => {
            isDragging = false;
            startY = 0;
            setDistance(0);
        };

        const isInteractiveTarget = (target: EventTarget | null) => {
            const element = target instanceof Element ? target : null;
            return Boolean(element?.closest(INTERACTIVE_SELECTOR));
        };

        const handleTouchStart = (event: TouchEvent) => {
            if (isRefreshingRef.current || event.touches.length !== 1) {
                return;
            }

            if (window.scrollY > 0 || isInteractiveTarget(event.target)) {
                return;
            }

            startY = event.touches[0].clientY;
            isDragging = true;
        };

        const handleTouchMove = (event: TouchEvent) => {
            if (!isDragging) {
                return;
            }

            if (window.scrollY > 0) {
                resetPull();
                return;
            }

            const delta = event.touches[0].clientY - startY;
            if (delta <= 0) {
                setDistance(0);
                return;
            }

            const dampenedDistance = Math.min(maxDistance, delta * 0.55);
            setDistance(dampenedDistance);

            if (!hasCrossedThreshold && dampenedDistance >= threshold) {
                hasCrossedThreshold = true;
                hapticTap();
            } else if (hasCrossedThreshold && dampenedDistance < threshold) {
                hasCrossedThreshold = false;
            }

            if (delta > 8) {
                event.preventDefault();
            }
        };

        const handleTouchEnd = () => {
            if (!isDragging) {
                setDistance(0);
                return;
            }

            const shouldRefresh = pullDistanceRef.current >= threshold;
            isDragging = false;
            hasCrossedThreshold = false;

            if (!shouldRefresh) {
                setDistance(0);
                return;
            }

            setIsRefreshing(true);
            setDistance(Math.min(threshold, maxDistance));

            Promise.resolve(onRefresh())
                .catch(() => {
                    // Page-level retry states handle any failures.
                })
                .finally(() => {
                    if (disposed) {
                        return;
                    }

                    hapticSuccess();
                    setIsRefreshing(false);
                    resetPull();
                });
        };

        window.addEventListener('touchstart', handleTouchStart, { passive: true });
        window.addEventListener('touchmove', handleTouchMove, { passive: false });
        window.addEventListener('touchend', handleTouchEnd, { passive: true });
        window.addEventListener('touchcancel', handleTouchEnd, { passive: true });

        return () => {
            disposed = true;
            window.removeEventListener('touchstart', handleTouchStart);
            window.removeEventListener('touchmove', handleTouchMove);
            window.removeEventListener('touchend', handleTouchEnd);
            window.removeEventListener('touchcancel', handleTouchEnd);
            if (animationFrame) {
                window.cancelAnimationFrame(animationFrame);
            }
        };
    }, [enabled, maxDistance, onRefresh, threshold]);

    return {
        isRefreshing,
        pullDistance,
        progress: Math.min(pullDistance / threshold, 1),
        isReady: pullDistance >= threshold,
    };
}
