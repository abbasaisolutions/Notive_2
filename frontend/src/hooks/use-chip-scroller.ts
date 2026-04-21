'use client';

import { useCallback, useEffect, useRef } from 'react';

/**
 * Auto-centers the active chip in a horizontal scroller. Pair with the
 * `chip-scroller` CSS utility. Returns a container ref and a setter for
 * per-item button refs keyed by chip id.
 */
export function useChipScroller<T extends string>(activeKey: T | null | undefined) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const itemRefs = useRef<Record<string, HTMLElement | null>>({});

    const registerItem = useCallback((key: string) => (node: HTMLElement | null) => {
        itemRefs.current[key] = node;
    }, []);

    useEffect(() => {
        const container = containerRef.current;
        if (!container || activeKey == null) return;
        const chip = itemRefs.current[activeKey];
        if (!chip) return;

        const targetLeft = chip.offsetLeft - (container.clientWidth - chip.offsetWidth) / 2;
        const maxLeft = Math.max(container.scrollWidth - container.clientWidth, 0);
        const nextScroll = Math.max(0, Math.min(targetLeft, maxLeft));
        if (Math.abs(container.scrollLeft - nextScroll) > 2) {
            container.scrollTo({ left: nextScroll, behavior: 'smooth' });
        }
    }, [activeKey]);

    return { containerRef, registerItem };
}
