'use client';

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useDialogA11y } from './use-dialog-a11y';

interface SheetProps {
    open: boolean;
    onClose: () => void;
    title?: string;
    ariaLabel?: string;
    children: React.ReactNode;
    className?: string;
}

/**
 * Bottom sheet on mobile, centered dialog on desktop (md:). Backdrop, focus
 * trap, and Escape-to-close match the Modal primitive.
 */
export function Sheet({ open, onClose, title, ariaLabel, children, className = '' }: SheetProps) {
    const containerRef = useDialogA11y(open, onClose);

    return (
        <AnimatePresence>
            {open && (
                <>
                    <motion.div
                        key="sheet-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm"
                        onClick={onClose}
                        role="presentation"
                    />
                    <motion.div
                        key="sheet-panel"
                        ref={containerRef}
                        initial={{ opacity: 0, y: '100%' }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: '100%' }}
                        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                        className={`fixed inset-x-0 bottom-0 z-[100] max-h-[88vh] overflow-hidden rounded-t-3xl border-t border-[rgba(92,92,92,0.12)] bg-[rgb(var(--paper-bg))] shadow-xl md:inset-x-auto md:inset-y-0 md:m-auto md:max-h-[560px] md:max-w-lg md:rounded-3xl md:border ${className}`}
                        style={{ bottom: 'var(--app-bottom-clearance, 0px)' }}
                        onClick={(event) => event.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                        aria-label={ariaLabel ?? title}
                    >
                        {title && (
                            <div className="flex items-center justify-between gap-4 border-b border-[rgba(92,92,92,0.1)] px-5 py-4">
                                <h2 className="text-base font-semibold text-strong">{title}</h2>
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="flex-shrink-0 h-7 w-7 rounded-full hover:bg-[rgba(92,92,92,0.08)] flex items-center justify-center"
                                    aria-label="Close"
                                >
                                    <svg className="h-4 w-4 text-ink-muted" fill="currentColor" viewBox="0 0 20 20">
                                        <path
                                            fillRule="evenodd"
                                            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                                            clipRule="evenodd"
                                        />
                                    </svg>
                                </button>
                            </div>
                        )}
                        <div className="overflow-y-auto max-h-[calc(88vh-3.5rem)]">
                            {children}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
