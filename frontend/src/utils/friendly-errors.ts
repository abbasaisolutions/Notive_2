const NETWORK_ERROR_PATTERNS = [
    /failed to fetch/i,
    /network(?:\s+request)?\s+failed/i,
    /networkerror/i,
    /load failed/i,
    /request timed out/i,
    /timeout/i,
];

const GENERIC_ERROR_PATTERNS = [
    /^something went wrong\.?$/i,
    /^unexpected error\.?$/i,
    /^unknown error\.?$/i,
    /^request failed\.?$/i,
    /^login failed\.?$/i,
    /^registration failed\.?$/i,
    /^google sign[- ]in failed\.?$/i,
    /^google sign[- ]up failed\.?$/i,
    /^failed to get authorization url\.?$/i,
    /^failed to initiate connection\.?$/i,
    /^failed to disconnect\.?$/i,
    /^failed to sync(?: music data)?\.?$/i,
    /^failed to reset password\.?$/i,
    /^failed to submit your deletion request\.?$/i,
];

const DEFAULT_NETWORK_FALLBACK = 'We couldn’t reach Notive right now. Check your connection and try again.';

const toErrorMessage = (value: unknown): string => {
    if (typeof value === 'string') {
        return value.trim();
    }

    if (value instanceof Error) {
        return value.message.trim();
    }

    if (value && typeof value === 'object') {
        const record = value as Record<string, unknown>;
        const candidates = [
            record.message,
            record.error,
            record.errorMessage,
            record.localizedMessage,
            record.reason,
        ];

        for (const candidate of candidates) {
            if (typeof candidate === 'string' && candidate.trim()) {
                return candidate.trim();
            }
        }
    }

    return '';
};

export function resolveFriendlyMessage(
    value: unknown,
    fallback: string,
    options?: { networkFallback?: string },
): string {
    const message = toErrorMessage(value);

    if (!message) {
        return fallback;
    }

    if (message.toLowerCase().startsWith('unexpected token ')) {
        return fallback;
    }

    if (NETWORK_ERROR_PATTERNS.some((pattern) => pattern.test(message))) {
        return options?.networkFallback || DEFAULT_NETWORK_FALLBACK;
    }

    if (GENERIC_ERROR_PATTERNS.some((pattern) => pattern.test(message))) {
        return fallback;
    }

    return message;
}
