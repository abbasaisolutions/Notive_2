'use client';

import { useEffect, useState } from 'react';
import { FiVolume2, FiVolumeX } from 'react-icons/fi';
import {
    audioFeedback,
    isAudioFeedbackEnabled,
    setAudioFeedbackEnabled,
} from '@/services/audio-feedback.service';

export default function DeviceSoundToggle() {
    const [enabled, setEnabled] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setEnabled(isAudioFeedbackEnabled());
        setMounted(true);
    }, []);

    const toggle = () => {
        const next = !enabled;
        setAudioFeedbackEnabled(next);
        setEnabled(next);
        if (next) {
            // Preview: soft page-turn so the user hears what they're opting into
            audioFeedback.pageTurn();
        }
    };

    if (!mounted) return null;

    return (
        <div className="workspace-panel flex items-center justify-between gap-4 p-5">
            <div className="flex items-center gap-3">
                <div
                    className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
                        enabled
                            ? 'bg-primary/12 text-primary'
                            : 'bg-[rgba(var(--paper-ink-muted),0.10)] text-muted'
                    }`}
                >
                    {enabled ? <FiVolume2 size={16} aria-hidden /> : <FiVolumeX size={16} aria-hidden />}
                </div>
                <div>
                    <p className="text-sm font-semibold text-strong">
                        {enabled ? 'Notebook sounds on' : 'Notebook sounds off'}
                    </p>
                    <p className="text-xs text-muted mt-0.5">
                        Quiet paper textures when you capture, record, and open notes. Stays on this device.
                    </p>
                </div>
            </div>
            <button
                type="button"
                role="switch"
                aria-checked={enabled}
                aria-label="Toggle notebook sounds"
                onClick={toggle}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                    enabled ? 'bg-primary' : 'bg-[rgba(var(--paper-ink),0.16)]'
                }`}
            >
                <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform ${
                        enabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                />
            </button>
        </div>
    );
}
