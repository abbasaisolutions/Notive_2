'use client';

import { FormEvent, useState } from 'react';
import { API_URL } from '@/constants/config';
import LegalPaperShell from '@/components/legal/LegalPaperShell';
import {
    LEGAL_COPYRIGHT_NOTICE,
    LEGAL_ENTITY_NAME,
    SUPPORT_EMAIL,
} from '@/config/legal';

const apiBaseUrl = API_URL.replace(/\/$/, '');

export default function AccountDeletionPage() {
    const [email, setEmail] = useState('');
    const [reason, setReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setIsSubmitting(true);
        setNotice(null);

        try {
            const response = await fetch(`${apiBaseUrl}/legal/account-deletion-requests`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email,
                    reason,
                }),
            });

            const payload = await response.json().catch(() => null);

            if (!response.ok) {
                throw new Error(payload?.message || 'Failed to submit your deletion request.');
            }

            setNotice({
                type: 'success',
                message: payload?.message || 'Your account deletion request has been submitted.',
            });
            setReason('');
        } catch (error) {
            setNotice({
                type: 'error',
                message: error instanceof Error ? error.message : 'Failed to submit your deletion request.',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <LegalPaperShell
            title="Account Deletion"
            intro={`${LEGAL_ENTITY_NAME} provides this form so you can request permanent deletion of your Notive account even if you can no longer sign in.`}
            actions={[
                { href: '/privacy', label: 'View Privacy Policy' },
                { href: '/terms', label: 'View Terms' },
                { href: '/register', label: 'Back to Sign Up', tone: 'primary' },
            ]}
            footer={LEGAL_COPYRIGHT_NOTICE}
        >
            <p>
                If you still have access to your account, the fastest option is inside the app:
                <span className="font-semibold text-[rgb(var(--paper-ink))]"> Profile &gt; Security &gt; Delete account</span>.
            </p>
            <p>
                Use the form below if you cannot access the app. Enter the email attached to the account you
                want removed. We will review the request and permanently delete the associated Notive account
                and active application data when the request is validated.
            </p>
            <p>
                We may retain limited records when required for fraud prevention, security, dispute resolution,
                or legal compliance.
            </p>
            {SUPPORT_EMAIL && (
                <p>
                    If you need direct help, contact{' '}
                    <a
                        href={`mailto:${SUPPORT_EMAIL}`}
                        className="font-semibold text-[rgb(var(--paper-ink))] underline underline-offset-4"
                    >
                        {SUPPORT_EMAIL}
                    </a>
                    .
                </p>
            )}

            <form onSubmit={handleSubmit} className="app-paper-soft mt-8 space-y-5 rounded-[1.6rem] p-5 md:p-6">
                <div className="space-y-2">
                    <label htmlFor="deletion-email" className="text-sm font-semibold text-[rgb(var(--paper-ink))]">
                        Account email
                    </label>
                    <input
                        id="deletion-email"
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        required
                        autoComplete="email"
                        className="workspace-input w-full rounded-2xl px-4 py-3 text-sm outline-none transition focus:border-primary"
                        placeholder="you@example.com"
                    />
                </div>

                <div className="space-y-2">
                    <label htmlFor="deletion-reason" className="text-sm font-semibold text-[rgb(var(--paper-ink))]">
                        Optional note
                    </label>
                    <textarea
                        id="deletion-reason"
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        rows={5}
                        maxLength={2000}
                        className="workspace-input w-full rounded-2xl px-4 py-3 text-sm outline-none transition focus:border-primary"
                        placeholder="Add context if you no longer have access to the app or need help locating the account."
                    />
                </div>

                {notice && (
                    <div
                        className={`rounded-2xl border px-4 py-3 text-sm ${
                            notice.type === 'success'
                                ? 'border-[rgba(138,154,111,0.32)] bg-[rgba(138,154,111,0.12)] text-[rgb(var(--paper-ink))]'
                                : 'border-[rgba(155,97,97,0.28)] bg-[rgba(155,97,97,0.08)] text-[rgb(var(--paper-ink))]'
                        }`}
                    >
                        {notice.message}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="workspace-button-primary rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {isSubmitting ? 'Submitting...' : 'Submit deletion request'}
                </button>
            </form>
        </LegalPaperShell>
    );
}
