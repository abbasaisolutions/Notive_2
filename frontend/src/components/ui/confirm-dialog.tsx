'use client';

import React, { useState } from 'react';
import { Modal } from './modal';
import { Button } from './form-elements';

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

    const handleConfirm = async () => {
        setLoading(true);
        try {
            await onConfirm();
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            open={open}
            onClose={onCancel}
            maxWidth="sm"
            role="alertdialog"
            labelledBy="confirm-title"
            describedBy={description ? 'confirm-description' : undefined}
            className="!rounded-2xl"
        >
            <div>
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
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={onCancel}
                        disabled={loading || isLoading}
                    >
                        {cancelLabel}
                    </Button>
                    <Button
                        type="button"
                        variant={isDangerous ? 'danger' : 'primary'}
                        size="sm"
                        onClick={handleConfirm}
                        isLoading={loading || isLoading}
                    >
                        {actionLabel}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
