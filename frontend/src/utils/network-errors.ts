export type NetworkErrorKind =
    | 'offline'
    | 'timeout'
    | 'auth-expired'
    | 'not-found'
    | 'rate-limited'
    | 'server'
    | 'unknown';

export interface NetworkErrorCopy {
    kind: NetworkErrorKind;
    title: string;
    description: string;
    retryable: boolean;
    actionHref?: string;
    actionLabel?: string;
}

function isOfflineNow(): boolean {
    return typeof navigator !== 'undefined' && navigator.onLine === false;
}

export function classifyNetworkError(error: unknown, status?: number): NetworkErrorCopy {
    if (isOfflineNow()) {
        return {
            kind: 'offline',
            title: "You're offline",
            description:
                "Your work is held safely on this device. Notive will finish syncing as soon as you're back online.",
            retryable: false,
        };
    }

    if (status === 401 || status === 403) {
        return {
            kind: 'auth-expired',
            title: 'Please sign in again',
            description:
                "Your session timed out. Nothing was lost — just sign back in to pick up where you left off.",
            retryable: false,
            actionHref: '/auth/login',
            actionLabel: 'Sign in',
        };
    }

    if (status === 404) {
        return {
            kind: 'not-found',
            title: "We couldn't find that",
            description: 'This page may have moved or was removed. Head back to your journal and try another path.',
            retryable: false,
        };
    }

    if (status === 429) {
        return {
            kind: 'rate-limited',
            title: 'A little too quick',
            description: "Too many requests in a row. Give it a moment, then try once more.",
            retryable: true,
        };
    }

    if (typeof status === 'number' && status >= 500) {
        return {
            kind: 'server',
            title: 'Notive is catching its breath',
            description: "A hiccup on our side. We're likely already on it — try again in a moment.",
            retryable: true,
        };
    }

    const message = error instanceof Error ? error.message.toLowerCase() : String(error ?? '').toLowerCase();

    if (message.includes('timeout') || message.includes('timed out') || message.includes('aborted')) {
        return {
            kind: 'timeout',
            title: 'That took longer than expected',
            description: 'The request timed out, usually because of a slow connection. Try once more.',
            retryable: true,
        };
    }

    if (
        message.includes('failed to fetch')
        || message.includes('networkerror')
        || message.includes('network request failed')
        || message.includes('load failed')
    ) {
        return {
            kind: 'offline',
            title: "Couldn't reach Notive",
            description: 'Your connection looks unstable. Your work is held here until we can sync again.',
            retryable: true,
        };
    }

    return {
        kind: 'unknown',
        title: 'Something went sideways',
        description: "The request didn't complete. Your notes are safe — try again in a moment.",
        retryable: true,
    };
}

export function extractStatus(error: unknown): number | undefined {
    if (!error || typeof error !== 'object') return undefined;
    const maybeStatus = (error as { status?: unknown }).status;
    if (typeof maybeStatus === 'number') return maybeStatus;
    const maybeResponse = (error as { response?: { status?: unknown } }).response;
    if (maybeResponse && typeof maybeResponse.status === 'number') return maybeResponse.status;
    return undefined;
}
