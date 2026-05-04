'use client';

import { useEffect, useState } from 'react';
import { FiCheck, FiCloud, FiEdit3 } from 'react-icons/fi';

type SaveConfidencePillProps = {
    isSaving?: boolean;
    lastSaved?: Date | null;
    pendingSync?: boolean;
    hasUnsavedChanges?: boolean;
    className?: string;
};

const formatSavedLabel = (lastSaved: Date | null | undefined) => {
    if (!lastSaved) return 'Draft held';
    const diffMs = Date.now() - lastSaved.getTime();
    if (diffMs < 60_000) return 'Saved just now';
    if (diffMs < 60 * 60_000) return `Saved ${Math.max(1, Math.round(diffMs / 60_000))}m ago`;
    return `Saved ${lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
};

export default function SaveConfidencePill({
    isSaving = false,
    lastSaved = null,
    pendingSync = false,
    hasUnsavedChanges = false,
    className = '',
}: SaveConfidencePillProps) {
    const [isOnline, setIsOnline] = useState(true);

    useEffect(() => {
        if (typeof navigator === 'undefined') return;
        const update = () => setIsOnline(navigator.onLine);
        update();
        window.addEventListener('online', update);
        window.addEventListener('offline', update);
        return () => {
            window.removeEventListener('online', update);
            window.removeEventListener('offline', update);
        };
    }, []);

    const offline = pendingSync || !isOnline;
    const Icon = offline ? FiCloud : isSaving || hasUnsavedChanges ? FiEdit3 : FiCheck;
    const label = offline
        ? 'Offline draft held'
        : isSaving
            ? 'Saving...'
            : hasUnsavedChanges
                ? 'Unsaved changes'
                : formatSavedLabel(lastSaved);

    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.08em] ${
                offline
                    ? 'border-[rgba(201,168,107,0.32)] bg-[rgba(234,216,189,0.18)] text-[rgb(145,111,56)]'
                    : isSaving || hasUnsavedChanges
                        ? 'border-[rgba(var(--paper-border),0.2)] bg-white/50 text-ink-secondary'
                        : 'border-[rgba(138,154,111,0.24)] bg-[rgba(138,154,111,0.1)] text-[rgb(107,143,113)]'
            } ${className}`}
            aria-live="polite"
        >
            <Icon size={12} className={isSaving ? 'animate-pulse' : ''} aria-hidden="true" />
            {label}
        </span>
    );
}
