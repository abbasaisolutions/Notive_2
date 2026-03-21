'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { API_URL } from '@/constants/config';
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
        <main className="min-h-screen px-6 py-12 md:px-10 md:py-16">
            <div className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-surface-1/70 p-8 md:p-10">
                <p className="mb-3 text-xs uppercase tracking-[0.18em] text-ink-muted">Notive Legal</p>
                <h1 className="mb-4 text-3xl font-serif text-white md:text-4xl">Account Deletion</h1>
                <p className="mb-6 text-sm text-ink-secondary">
                    {LEGAL_ENTITY_NAME} provides this web form so you can request permanent deletion of your Notive
                    account even if you can no longer sign in to the app.
                </p>

                <div className="space-y-4 text-sm text-ink-secondary">
                    <p>
                        If you still have access to your account, the fastest option is inside the app:
                        <span className="text-white"> Profile &gt; Security &gt; Delete account</span>.
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
                            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-white underline underline-offset-4">
                                {SUPPORT_EMAIL}
                            </a>
                            .
                        </p>
                    )}
                </div>

                <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                    <div className="space-y-2">
                        <label htmlFor="deletion-email" className="text-sm font-semibold text-white">
                            Account email
                        </label>
                        <input
                            id="deletion-email"
                            type="email"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            required
                            autoComplete="email"
                            className="w-full rounded-2xl border border-white/12 bg-[#0d1323] px-4 py-3 text-sm text-white outline-none transition focus:border-primary"
                            placeholder="you@example.com"
                        />
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="deletion-reason" className="text-sm font-semibold text-white">
                            Optional note
                        </label>
                        <textarea
                            id="deletion-reason"
                            value={reason}
                            onChange={(event) => setReason(event.target.value)}
                            rows={5}
                            maxLength={2000}
                            className="w-full rounded-2xl border border-white/12 bg-[#0d1323] px-4 py-3 text-sm text-white outline-none transition focus:border-primary"
                            placeholder="Add context if you no longer have access to the app or need help locating the account."
                        />
                    </div>

                    {notice && (
                        <div
                            className={`rounded-2xl border px-4 py-3 text-sm ${
                                notice.type === 'success'
                                    ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-100'
                                    : 'border-rose-500/25 bg-rose-500/10 text-rose-100'
                            }`}
                        >
                            {notice.message}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {isSubmitting ? 'Submitting...' : 'Submit deletion request'}
                    </button>
                </form>

                <div className="mt-8 flex flex-wrap items-center gap-3">
                    <Link href="/privacy" className="rounded-xl border border-white/15 px-4 py-2 text-sm text-ink-secondary hover:text-white">
                        View Privacy Policy
                    </Link>
                    <Link href="/terms" className="rounded-xl border border-white/15 px-4 py-2 text-sm text-ink-secondary hover:text-white">
                        View Terms
                    </Link>
                    <Link href="/register" className="rounded-xl border border-white/15 px-4 py-2 text-sm text-ink-secondary hover:text-white">
                        Back to Sign Up
                    </Link>
                </div>

                <p className="mt-6 text-xs text-ink-muted">{LEGAL_COPYRIGHT_NOTICE}</p>
            </div>
        </main>
    );
}
