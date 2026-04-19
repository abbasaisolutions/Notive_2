'use client';

import { useEffect, useMemo } from 'react';
import * as Sentry from '@sentry/react';
import ErrorState from '@/components/error/ErrorState';
import { classifyNetworkError, extractStatus } from '@/utils/network-errors';

type RouteErrorStateProps = {
    error: Error & { digest?: string };
    reset: () => void;
    route: string;
    title?: string;
    message?: string;
};

export default function RouteErrorState({
    error,
    reset,
    route,
    title,
    message,
}: RouteErrorStateProps) {
    useEffect(() => {
        try {
            Sentry.captureException(error, {
                tags: { route },
            });
        } catch {
            // Sentry is optional in local/dev.
        }
    }, [error, route]);

    const copy = useMemo(
        () => classifyNetworkError(error, extractStatus(error)),
        [error],
    );

    // Route-specific title/message only wins when the failure is genuinely unclassified.
    // For offline / auth-expired / server / timeout etc. the empathetic classified copy
    // is more useful than a generic "your X didn't load" message.
    const useRouteCopy = copy.kind === 'unknown';
    const resolvedTitle = useRouteCopy && title ? title : copy.title;
    const resolvedMessage = useRouteCopy && message ? message : copy.description;

    return (
        <ErrorState
            title={resolvedTitle}
            message={resolvedMessage}
            onRetry={copy.retryable ? reset : undefined}
            kind={copy.kind}
            actionHref={copy.actionHref}
            actionLabel={copy.actionLabel}
        />
    );
}
