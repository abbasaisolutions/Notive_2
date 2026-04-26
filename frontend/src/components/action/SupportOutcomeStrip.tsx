'use client';

import React, { useMemo, useState } from 'react';
import { API_URL } from '@/constants/config';
import useApi from '@/hooks/use-api';
import useTelemetry from '@/hooks/use-telemetry';

type SupportOutcomeStripProps = {
    contactId?: string | null;
    contactName: string;
    channel?: 'text' | 'call' | 'in_person' | null;
    surface: 'dashboard' | 'guide' | 'entry' | 'safety';
    source: 'bridge' | 'safety';
    riskLevel?: 'none' | 'yellow' | 'orange' | 'red';
    entryId?: string | null;
    actionKind?: 'copy' | 'text' | 'call' | 'email' | 'manual';
    variant?: 'default' | 'notebook';
};

type ContactOutcome = 'helped' | 'still_need_support';

const buildPrompt = (
    contactName: string,
    actionKind?: 'copy' | 'text' | 'call' | 'email' | 'manual',
    channel?: 'text' | 'call' | 'in_person' | null
) => {
    if (actionKind === 'text') return `After you texted ${contactName}, tell Notive what happened.`;
    if (actionKind === 'call') return `After you called ${contactName}, tell Notive what happened.`;
    if (actionKind === 'email') return `After you emailed ${contactName}, tell Notive what happened.`;
    if (actionKind === 'copy') return `If you used the draft for ${contactName}, tell Notive whether it helped.`;
    if (channel === 'in_person') return `If you talked with ${contactName} in person, tell Notive how it went.`;
    return `If you reached out to ${contactName}, tell Notive whether that helped.`;
};

const buildSavedMessage = (
    contactName: string,
    outcome: ContactOutcome,
    source: 'bridge' | 'safety'
) => {
    if (outcome === 'helped') {
        return source === 'safety'
            ? `Saved. Notive will remember that ${contactName} helped in a heavier moment.`
            : `Saved. Notive will remember that ${contactName} was a helpful handoff here.`;
    }

    return source === 'safety'
        ? `Saved. Keep the safety card close and reach out again if you still need support.`
        : 'Saved. Notive will look for a steadier next handoff.';
};

export default function SupportOutcomeStrip({
    contactId,
    contactName,
    channel,
    surface,
    source,
    riskLevel,
    entryId,
    actionKind,
    variant = 'default',
}: SupportOutcomeStripProps) {
    const { apiFetch } = useApi();
    const { trackEvent } = useTelemetry();
    const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const [pendingOutcome, setPendingOutcome] = useState<ContactOutcome | null>(null);
    const [savedOutcome, setSavedOutcome] = useState<ContactOutcome | null>(null);

    const headline = useMemo(
        () => (source === 'safety'
            ? `Did ${contactName} help this moment feel a little safer?`
            : `Did ${contactName} help?`),
        [contactName, source]
    );

    const prompt = useMemo(
        () => buildPrompt(contactName, actionKind, channel),
        [actionKind, channel, contactName]
    );
    const isNotebook = variant === 'notebook';

    const handleSubmit = async (outcome: ContactOutcome) => {
        if (status === 'saving') return;

        setStatus('saving');
        setPendingOutcome(outcome);

        try {
            const response = await apiFetch(`/ai/contact-outcome`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contactId,
                    contactName,
                    outcome,
                    source,
                    surface,
                    actionKind,
                    channel,
                    riskLevel,
                    entryId,
                }),
            });

            if (!response.ok) {
                throw new Error(`Failed to record support outcome (${response.status})`);
            }

            setSavedOutcome(outcome);
            setStatus('saved');
            void trackEvent({
                eventType: 'support_contact_outcome_recorded',
                field: 'outcome',
                value: outcome,
                metadata: {
                    contactId: contactId || null,
                    contactName,
                    source,
                    surface,
                    actionKind: actionKind || null,
                    channel: channel || null,
                    riskLevel: riskLevel || null,
                    entryId: entryId || null,
                },
            });
        } catch (error) {
            console.error('Failed to save support outcome:', error);
            setStatus('error');
            void trackEvent({
                eventType: 'support_contact_outcome_failed',
                field: 'outcome',
                value: outcome,
                metadata: {
                    contactName,
                    source,
                    surface,
                    actionKind: actionKind || null,
                },
            });
        } finally {
            setPendingOutcome(null);
        }
    };

    return (
        <div className={isNotebook ? 'notebook-card-soft rounded-[1.5rem] p-4' : 'rounded-2xl border border-white/10 bg-black/20 p-4'}>
            <p className={isNotebook ? 'notebook-kicker' : 'text-xs uppercase tracking-[0.14em] text-ink-muted'}>Support Loop</p>
            <p className={isNotebook ? 'notebook-title mt-2 text-xl' : 'mt-2 text-sm font-semibold text-white'}>{headline}</p>

            {status === 'saved' && savedOutcome ? (
                <p className={isNotebook ? 'notebook-copy mt-2 text-sm leading-7' : 'mt-2 text-sm leading-7 text-emerald-100/90'}>
                    {buildSavedMessage(contactName, savedOutcome, source)}
                </p>
            ) : (
                <>
                    <p className={isNotebook ? 'notebook-copy mt-2 text-sm leading-7' : 'mt-2 text-sm leading-7 text-ink-secondary'}>{prompt}</p>
                    {status === 'error' && (
                        <p className={isNotebook ? 'mt-2 text-sm leading-7 text-[rgb(var(--paper-ink-soft))]' : 'mt-2 text-sm leading-7 text-rose-200/90'}>
                            Notive could not save that just now. You can try again.
                        </p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => void handleSubmit('helped')}
                            disabled={status === 'saving'}
                            className={isNotebook
                                ? 'notebook-primary-cta rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] disabled:cursor-not-allowed disabled:opacity-60'
                                : 'rounded-full border border-emerald-300/25 bg-emerald-300/[0.10] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-white transition-colors hover:bg-emerald-300/[0.16] disabled:cursor-not-allowed disabled:opacity-60'}
                        >
                            {status === 'saving' && pendingOutcome === 'helped' ? 'Saving...' : 'That helped'}
                        </button>
                        <button
                            type="button"
                            onClick={() => void handleSubmit('still_need_support')}
                            disabled={status === 'saving'}
                            className={isNotebook
                                ? 'notebook-secondary-cta rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] disabled:cursor-not-allowed disabled:opacity-60'
                                : 'rounded-full border border-amber-300/25 bg-amber-300/[0.10] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-white transition-colors hover:bg-amber-300/[0.16] disabled:cursor-not-allowed disabled:opacity-60'}
                        >
                            {status === 'saving' && pendingOutcome === 'still_need_support' ? 'Saving...' : 'Still need support'}
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
