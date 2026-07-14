'use client';

import React from 'react';
import { useDialogA11y } from './use-dialog-a11y';

interface ModalProps {
    open: boolean;
    onClose: () => void;
    title?: string;
    labelledBy?: string;
    describedBy?: string;
    maxWidth?: 'sm' | 'md' | 'lg';
    role?: 'dialog' | 'alertdialog';
    children: React.ReactNode;
    className?: string;
    backdropClassName?: string;
}

const MAX_WIDTH_CLASSES: Record<NonNullable<ModalProps['maxWidth']>, string> = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
};

/**
 * Centered dialog shell: backdrop, focus trap, Escape-to-close.
 * Pass `title` for a built-in header, or omit it and lay out `children` yourself.
 */
export function Modal({
    open,
    onClose,
    title,
    labelledBy = 'modal-title',
    describedBy,
    maxWidth = 'md',
    role = 'dialog',
    children,
    className = '',
    backdropClassName = 'bg-black/30',
}: ModalProps) {
    const containerRef = useDialogA11y(open, onClose);

    if (!open) return null;

    return (
        <>
            <div
                className={`fixed inset-0 z-40 backdrop-blur-sm ${backdropClassName}`}
                onClick={onClose}
                role="presentation"
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div
                    ref={containerRef}
                    className={`workspace-panel rounded-2xl shadow-xl w-full ${MAX_WIDTH_CLASSES[maxWidth]} animate-in fade-in-0 zoom-in-95 duration-200 ${className}`}
                    role={role}
                    aria-modal="true"
                    aria-labelledby={labelledBy}
                    aria-describedby={describedBy}
                >
                    {title && (
                        <div className="flex items-start gap-4 p-6 border-b border-[rgba(var(--paper-border),0.5)]">
                            <h2 id={labelledBy} className="flex-1 text-lg font-semibold text-strong">
                                {title}
                            </h2>
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-shrink-0 h-6 w-6 rounded hover:bg-[rgba(var(--paper-border),0.3)] flex items-center justify-center"
                                aria-label="Close dialog"
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
                    {children}
                </div>
            </div>
        </>
    );
}
