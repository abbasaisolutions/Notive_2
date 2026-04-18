'use client';

import React, { useEffect, useState } from 'react';
import { SAFETY_ALERTS_PREF_KEY } from '@/components/safety/PostSaveSafetyDialog';

export default function SafetyAlertsToggle() {
    const [enabled, setEnabled] = useState<boolean>(true);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        try {
            const raw = window.localStorage.getItem(SAFETY_ALERTS_PREF_KEY);
            setEnabled(raw !== 'false');
        } catch {
            // ignore storage errors
        }
    }, []);

    const handleToggle = () => {
        const next = !enabled;
        setEnabled(next);
        try {
            window.localStorage.setItem(SAFETY_ALERTS_PREF_KEY, next ? 'true' : 'false');
        } catch {
            // ignore storage errors
        }
    };

    return (
        <div className="workspace-soft-panel rounded-[1.4rem] p-5">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <p className="text-xs uppercase tracking-[0.14em] text-ink-muted">Post-save safety prompts</p>
                    <p className="mt-2 text-lg font-semibold text-[rgb(var(--text-primary))]">
                        {mounted && !enabled ? 'Off' : 'On'}
                    </p>
                    <p className="mt-2 text-sm leading-7 text-ink-secondary">
                        When an entry mentions heavy or safety-related language, show a soft pause with helpful resources after you save. Your note is always saved either way.
                    </p>
                </div>
                <button
                    type="button"
                    role="switch"
                    aria-checked={enabled}
                    aria-label="Toggle post-save safety prompts"
                    onClick={handleToggle}
                    className={`inline-flex h-8 w-16 items-center rounded-full border px-1 transition-colors ${
                        enabled
                            ? 'border-[rgb(var(--brand))]/30 bg-[rgb(var(--brand))]/15 justify-end'
                            : 'workspace-pill justify-start'
                    }`}
                >
                    <span className="h-6 w-6 rounded-full bg-white shadow-sm" />
                </button>
            </div>
        </div>
    );
}
