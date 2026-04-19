'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/react';
import Link from 'next/link';
import { FiRefreshCw } from 'react-icons/fi';

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        try {
            Sentry.captureException(error);
        } catch {
            // Sentry may not be configured in local/dev; swallow.
        }
    }, [error]);

    return (
        <html lang="en">
            <body className="bg-[rgb(var(--bg-canvas))]">
                <div className="flex min-h-screen items-center justify-center px-6 py-10">
                    <div className="w-full max-w-md rounded-[2rem] border border-[rgba(var(--paper-border),0.92)] bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(255,250,244,0.96))] p-8 text-center shadow-[0_20px_60px_rgba(92,92,92,0.12)]">
                        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[rgb(var(--paper-sage))]">
                            Notive
                        </p>
                        <h1 className="mt-3 text-3xl font-serif text-[rgb(var(--paper-ink))]">
                            Something went sideways
                        </h1>
                        <p className="mt-3 text-sm leading-7 text-[rgb(var(--paper-ink-soft))]">
                            The page hit a snag, but your notes are still safe. Try again, or head back to your dashboard.
                        </p>
                        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
                            <button
                                onClick={reset}
                                className="inline-flex items-center justify-center gap-2 rounded-full bg-[rgb(var(--paper-sage))] px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
                            >
                                <FiRefreshCw className="h-4 w-4" aria-hidden="true" />
                                Try again
                            </button>
                            <Link
                                href="/dashboard"
                                className="inline-flex items-center justify-center rounded-full border border-[rgba(var(--paper-border),0.92)] bg-white/70 px-5 py-2.5 text-sm font-medium text-[rgb(var(--paper-ink))] transition-colors hover:bg-white"
                            >
                                Back to dashboard
                            </Link>
                        </div>
                    </div>
                </div>
            </body>
        </html>
    );
}
