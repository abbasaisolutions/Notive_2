'use client';

import { useEffect, useRef } from 'react';

/**
 * While the user is actively typing, fade non-essential chrome via
 * `[data-zen-mode='true']` on `<body>`. After IDLE_MS with no keystroke,
 * Zen turns off and chrome returns. Any non-typing interaction (scroll,
 * touch, mouse move) also turns it off immediately.
 */
export function useZenMode(active: boolean, contentLength: number): void {
    const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastContentLenRef = useRef<number>(contentLength);

    useEffect(() => {
        if (!active || typeof document === 'undefined') return;

        const body = document.body;
        const IDLE_MS = 2000;

        const enterZen = () => {
            body.setAttribute('data-zen-mode', 'true');
        };
        const exitZen = () => {
            body.setAttribute('data-zen-mode', 'false');
        };
        const restartIdleTimer = () => {
            if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
            idleTimerRef.current = setTimeout(exitZen, IDLE_MS);
        };

        const onInteractionAway = () => exitZen();

        window.addEventListener('scroll', onInteractionAway, { passive: true });
        window.addEventListener('touchmove', onInteractionAway, { passive: true });
        window.addEventListener('mousedown', onInteractionAway, { passive: true });

        // React to each keystroke via content-length diff from parent effect below.
        // We use an interval-free approach: parent useEffect triggers on every
        // content change because `contentLength` is in deps.

        return () => {
            if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
            window.removeEventListener('scroll', onInteractionAway);
            window.removeEventListener('touchmove', onInteractionAway);
            window.removeEventListener('mousedown', onInteractionAway);
            body.removeAttribute('data-zen-mode');
        };
    }, [active]);

    useEffect(() => {
        if (!active || typeof document === 'undefined') return;
        if (contentLength === lastContentLenRef.current) return;
        lastContentLenRef.current = contentLength;

        document.body.setAttribute('data-zen-mode', 'true');
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
        idleTimerRef.current = setTimeout(() => {
            document.body.setAttribute('data-zen-mode', 'false');
        }, 2000);
    }, [contentLength, active]);
}
