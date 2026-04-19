'use client';

import Link from 'next/link';
import { FiAlertTriangle, FiRefreshCw, FiWifiOff, FiClock, FiLogIn, FiServer } from 'react-icons/fi';
import type { NetworkErrorKind } from '@/utils/network-errors';

interface ErrorStateProps {
    title?: string;
    message?: string;
    onRetry?: () => void;
    showHome?: boolean;
    kind?: NetworkErrorKind;
    actionHref?: string;
    actionLabel?: string;
}

const ICON_BY_KIND: Record<NetworkErrorKind, typeof FiAlertTriangle> = {
    offline: FiWifiOff,
    timeout: FiClock,
    'auth-expired': FiLogIn,
    'not-found': FiAlertTriangle,
    'rate-limited': FiClock,
    server: FiServer,
    unknown: FiAlertTriangle,
};

export default function ErrorState({
    title = 'Something went sideways',
    message = "The page stumbled on the way in. Your notes are safe — try again in a moment.",
    onRetry,
    showHome = true,
    kind = 'unknown',
    actionHref,
    actionLabel,
}: ErrorStateProps) {
    const Icon = ICON_BY_KIND[kind] ?? FiAlertTriangle;

    return (
        <div className="min-h-[60vh] flex items-center justify-center px-6 py-12">
            <div className="workspace-panel max-w-md w-full rounded-[2rem] p-8 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
                    <Icon className="h-6 w-6 text-amber-700" aria-hidden="true" />
                </div>
                <h1 className="type-title-md text-strong mb-2">{title}</h1>
                <p className="type-body-sm text-ink-muted mb-6">{message}</p>
                <div className="flex flex-col sm:flex-row gap-2 justify-center">
                    {actionHref && actionLabel && (
                        <Link
                            href={actionHref}
                            className="inline-flex items-center justify-center gap-2 rounded-full bg-[rgb(var(--paper-sage))] px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
                        >
                            {actionLabel}
                        </Link>
                    )}
                    {onRetry && !actionHref && (
                        <button
                            type="button"
                            onClick={onRetry}
                            className="inline-flex items-center justify-center gap-2 rounded-full bg-[rgb(var(--paper-sage))] px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
                        >
                            <FiRefreshCw className="h-4 w-4" aria-hidden="true" />
                            Try again
                        </button>
                    )}
                    {showHome && (
                        <Link
                            href="/dashboard"
                            className="inline-flex items-center justify-center rounded-full border border-ink-muted/20 bg-white/60 px-5 py-2.5 text-sm font-medium text-strong transition-colors hover:bg-white"
                        >
                            Back to dashboard
                        </Link>
                    )}
                </div>
            </div>
        </div>
    );
}
