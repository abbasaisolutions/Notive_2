'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Spinner } from './spinner';

interface ConfirmDialogProps {
    open: boolean;
    title: string;
    description?: string;
    actionLabel?: string;
    cancelLabel?: string;
    isDangerous?: boolean;
    isLoading?: boolean;
    onConfirm: () => void | Promise<void>;
    onCancel: () => void;
}

/**
 * Confirmation dialog for destructive or important actions
 * Shows a modal that requires user confirmation before proceeding
 */
export function ConfirmDialog({
    open,
    title,
    description,
    actionLabel = 'Confirm',
    cancelLabel = 'Cancel',
    isDangerous = false,
    isLoading = false,
    onConfirm,
    onCancel,
}: ConfirmDialogProps) {
    const [loading, setLoading] = useState(false);
    const dialogRef = useRef<HTMLDivElement>(null);
    const previousFocusRef = useRef<HTMLElement | null>(null);

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            onCancel();
            return;
        }
        if (e.key !== 'Tab' || !dialogRef.current) return;

        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
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
    }, [onCancel]);

    useEffect(() => {
        if (!open) return;
        previousFocusRef.current = document.activeElement as HTMLElement;
        document.addEventListener('keydown', handleKeyDown);
        // Auto-focus the cancel button for safer default
        const timer = setTimeout(() => {
            const cancelBtn = dialogRef.current?.querySelector<HTMLElement>('button');
            cancelBtn?.focus();
        }, 50);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            clearTimeout(timer);
            previousFocusRef.current?.focus();
        };
    }, [open, handleKeyDown]);

    const handleConfirm = async () => {
        setLoading(true);
        try {
            await onConfirm();
        } finally {
            setLoading(false);
        }
    };

    if (!open) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
                onClick={onCancel}
                role="presentation"
            />

            {/* Modal */}
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div
                    ref={dialogRef}
                    className="workspace-panel rounded-2xl shadow-xl max-w-sm w-full animate-in fade-in-0 zoom-in-95 duration-200"
                    role="alertdialog"
                    aria-modal="true"
                    aria-labelledby="confirm-title"
                    aria-describedby="confirm-description"
                >
                    {/* Header */}
                    <div className="flex items-start gap-4 p-6 border-b border-[rgba(var(--paper-border),0.5)]">
                        {isDangerous && (
                            <div className="flex-shrink-0 h-10 w-10 rounded-full bg-danger/10 flex items-center justify-center">
                                <svg className="h-6 w-6 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                    />
                                </svg>
                            </div>
                        )}
                        <div className="flex-1">
                            <h2 id="confirm-title" className="text-lg font-semibold text-[rgb(var(--text-primary))]">
                                {title}
                            </h2>
                        </div>
                        <button
                            onClick={onCancel}
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

                    {/* Body */}
                    {description && (
                        <div className="p-6 border-b border-[rgba(var(--paper-border),0.5)]">
                            <p id="confirm-description" className="text-ink-secondary">
                                {description}
                            </p>
                        </div>
                    )}

                    {/* Footer */}
                    <div className="flex gap-3 p-6 justify-end">
                        <button
                            onClick={onCancel}
                            disabled={loading || isLoading}
                            className="workspace-button-outline rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50 transition-colors"
                        >
                            {cancelLabel}
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={loading || isLoading}
                            className={`
                                rounded-xl px-4 py-2 text-sm font-semibold text-white
                                flex items-center justify-center gap-2
                                disabled:opacity-50 transition-colors
                                ${
                                    isDangerous
                                        ? 'bg-danger hover:bg-danger/90'
                                        : 'bg-primary hover:bg-primary/90'
                                }
                            `}
                        >
                            {loading || isLoading ? <Spinner size="sm" variant="white" /> : null}
                            {actionLabel}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
