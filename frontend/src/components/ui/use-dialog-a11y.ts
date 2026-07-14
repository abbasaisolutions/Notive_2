import { useCallback, useEffect, useRef } from 'react';

/**
 * Shared focus-trap + Escape-to-close behavior for modal/sheet overlays.
 * Traps Tab navigation inside the dialog, restores focus to the trigger on close,
 * and calls onClose on Escape.
 */
export function useDialogA11y(open: boolean, onClose: () => void) {
    const containerRef = useRef<HTMLDivElement>(null);
    const previousFocusRef = useRef<HTMLElement | null>(null);

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            onClose();
            return;
        }
        if (e.key !== 'Tab' || !containerRef.current) return;

        const focusable = containerRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
        }
    }, [onClose]);

    useEffect(() => {
        if (!open) return;
        previousFocusRef.current = document.activeElement as HTMLElement;
        document.addEventListener('keydown', handleKeyDown);
        const timer = setTimeout(() => {
            const firstFocusable = containerRef.current?.querySelector<HTMLElement>(
                'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
            );
            firstFocusable?.focus();
        }, 50);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            clearTimeout(timer);
            previousFocusRef.current?.focus();
        };
    }, [open, handleKeyDown]);

    return containerRef;
}
