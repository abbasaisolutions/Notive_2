'use client';

import { useEffect, useState } from 'react';
import {
    DEFAULT_EXCEPTIONAL_UX_PREFERENCES,
    type AiResponseTone,
    type ExceptionalUxPreferences,
    type InsightConsentMode,
    getToneMicrocopy,
    readExceptionalUxPreferences,
    writeExceptionalUxPreferences,
} from '@/utils/exceptional-ux';

const TONE_OPTIONS: Array<{ value: AiResponseTone; label: string }> = [
    { value: 'gentle', label: 'Gentle' },
    { value: 'practical', label: 'Practical' },
    { value: 'reflective', label: 'Reflective' },
    { value: 'direct', label: 'Direct' },
];

const CONSENT_OPTIONS: Array<{ value: InsightConsentMode; label: string; helper: string }> = [
    { value: 'normal', label: 'Normal', helper: 'Show useful insights when ready.' },
    { value: 'ask', label: 'Ask', helper: 'Prefer explicit confirmation before deeper reads.' },
    { value: 'quiet', label: 'Quiet', helper: 'Keep AI quieter and user-led.' },
];

export default function ExperienceControlPanel({ compact = false }: { compact?: boolean }) {
    const [preferences, setPreferences] = useState<ExceptionalUxPreferences>(DEFAULT_EXCEPTIONAL_UX_PREFERENCES);

    useEffect(() => {
        setPreferences(readExceptionalUxPreferences());
    }, []);

    const update = (patch: Partial<ExceptionalUxPreferences>) => {
        setPreferences((current) => {
            const next = { ...current, ...patch };
            writeExceptionalUxPreferences(next);
            window.dispatchEvent(new CustomEvent('notive:exceptional-ux-preferences-changed', { detail: next }));
            return next;
        });
    };

    return (
        <section className={`rounded-[1.25rem] border border-[rgba(92,92,92,0.12)] bg-[rgba(255,255,255,0.36)] ${compact ? 'p-3' : 'p-4'}`}>
            <div>
                <p className="section-label">Notive style</p>
                <h3 className="notebook-title mt-1 text-[1rem] leading-tight">Tune how the app responds.</h3>
                <p className="mt-1.5 text-[0.72rem] leading-5 text-[rgb(107,107,107)]">
                    These controls stay on this device and shape the UX tone, insight posture, and private capture default.
                </p>
            </div>

            <div className="mt-3 space-y-3">
                <div>
                    <p className="mb-1.5 text-[0.58rem] font-bold uppercase tracking-[0.1em] text-[rgb(107,107,107)]">AI tone</p>
                    <div className="grid grid-cols-4 gap-1.5">
                        {TONE_OPTIONS.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => update({ aiTone: option.value })}
                                aria-pressed={preferences.aiTone === option.value}
                                className={`rounded-[0.8rem] border px-2 py-2 text-[0.66rem] font-semibold transition-colors ${preferences.aiTone === option.value
                                    ? 'border-[rgba(138,154,111,0.44)] bg-[rgba(138,154,111,0.16)] text-[rgb(118,134,91)]'
                                    : 'border-[rgba(92,92,92,0.1)] bg-[rgba(255,255,255,0.38)] text-[rgb(107,107,107)] hover:bg-[rgba(255,255,255,0.62)]'
                                }`}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                    <p className="mt-1.5 text-[0.68rem] leading-5 text-[rgb(107,107,107)]">{getToneMicrocopy(preferences.aiTone)}</p>
                </div>

                <div className="grid gap-2 sm:grid-cols-3">
                    {CONSENT_OPTIONS.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => update({ insightConsent: option.value })}
                            aria-pressed={preferences.insightConsent === option.value}
                            className={`rounded-[0.9rem] border px-3 py-2 text-left transition-colors ${preferences.insightConsent === option.value
                                ? 'border-[rgba(216,199,232,0.46)] bg-[rgba(216,199,232,0.16)]'
                                : 'border-[rgba(92,92,92,0.1)] bg-[rgba(255,255,255,0.32)] hover:bg-[rgba(255,255,255,0.58)]'
                            }`}
                        >
                            <span className="block text-[0.7rem] font-semibold text-[rgb(var(--paper-ink))]">{option.label}</span>
                            <span className="mt-0.5 block text-[0.62rem] leading-4 text-[rgb(107,107,107)]">{option.helper}</span>
                        </button>
                    ))}
                </div>

                <label className="flex cursor-pointer items-start gap-3 rounded-[0.95rem] border border-[rgba(92,92,92,0.1)] bg-[rgba(255,255,255,0.34)] px-3 py-2.5">
                    <input
                        type="checkbox"
                        checked={preferences.privateEntryByDefault}
                        onChange={(event) => update({ privateEntryByDefault: event.target.checked })}
                        className="mt-1 h-4 w-4 rounded border-[rgba(92,92,92,0.25)] accent-[rgb(118,134,91)]"
                    />
                    <span>
                        <span className="block text-[0.74rem] font-semibold text-[rgb(var(--paper-ink))]">Private capture by default</span>
                        <span className="mt-0.5 block text-[0.66rem] leading-5 text-[rgb(107,107,107)]">
                            New entries start in “keep out of insights” mode until you turn it off.
                        </span>
                    </span>
                </label>
            </div>
        </section>
    );
}
