'use client';

type ApiFetch = (input: string, init?: { retryOnUnauthorized?: boolean }) => Promise<Response>;

type CreateSharedCountStoreOptions = {
    endpoint: string;
    getCount: (data: any) => number;
    refreshEventName?: string;
};

type ConnectOptions = {
    accessToken: string | null | undefined;
    apiFetch: ApiFetch;
    intervalMs: number;
};

type Listener = () => void;

export function createSharedCountStore({
    endpoint,
    getCount,
    refreshEventName,
}: CreateSharedCountStoreOptions) {
    let snapshot = 0;
    let apiFetch: ApiFetch | null = null;
    let hasAccessToken = false;
    let stopped = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    let inFlight: Promise<void> | null = null;
    let activeConnections = 0;
    let windowListenersAttached = false;

    const listeners = new Set<Listener>();
    const intervalUsage = new Map<number, number>();

    const emit = () => {
        listeners.forEach((listener) => listener());
    };

    const setSnapshot = (next: number) => {
        if (snapshot === next) return;
        snapshot = next;
        emit();
    };

    const clearTimer = () => {
        if (timer) {
            clearInterval(timer);
            timer = null;
        }
    };

    const getIntervalMs = () => {
        const requested = [...intervalUsage.keys()].filter((value) => value > 0);
        return requested.length > 0 ? Math.min(...requested) : 60_000;
    };

    const isDocumentHidden = () =>
        typeof document !== 'undefined' && document.visibilityState === 'hidden';

    const syncTimer = () => {
        clearTimer();
        if (!hasAccessToken || stopped || activeConnections === 0 || isDocumentHidden()) {
            return;
        }
        timer = setInterval(() => {
            void refresh();
        }, getIntervalMs());
    };

    const handleVisibilityChange = () => {
        if (isDocumentHidden()) {
            clearTimer();
            return;
        }
        syncTimer();
        void refresh();
    };

    const handleRefreshEvent = () => {
        if (isDocumentHidden()) return;
        void refresh();
    };

    const attachWindowListeners = () => {
        if (windowListenersAttached || typeof window === 'undefined') return;
        if (refreshEventName) {
            window.addEventListener(refreshEventName, handleRefreshEvent);
        }
        if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', handleVisibilityChange);
        }
        window.addEventListener('focus', handleVisibilityChange);
        windowListenersAttached = true;
    };

    const detachWindowListeners = () => {
        if (!windowListenersAttached || typeof window === 'undefined') return;
        if (refreshEventName) {
            window.removeEventListener(refreshEventName, handleRefreshEvent);
        }
        if (typeof document !== 'undefined') {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        }
        window.removeEventListener('focus', handleVisibilityChange);
        windowListenersAttached = false;
    };

    const refresh = async () => {
        if (inFlight) return inFlight;
        if (!apiFetch || !hasAccessToken || stopped) return;

        inFlight = (async () => {
            try {
                const response = await apiFetch(endpoint, { retryOnUnauthorized: false });

                if (response.ok) {
                    const data = await response.json();
                    setSnapshot(getCount(data));
                    return;
                }

                if (response.status === 401) {
                    stopped = true;
                    clearTimer();
                }
            } catch {
                // Keep current snapshot and retry on the next scheduled refresh.
            } finally {
                inFlight = null;
            }
        })();

        return inFlight;
    };

    const connect = ({ accessToken, apiFetch: nextApiFetch, intervalMs }: ConnectOptions) => {
        activeConnections += 1;
        intervalUsage.set(intervalMs, (intervalUsage.get(intervalMs) ?? 0) + 1);
        apiFetch = nextApiFetch;

        const hadAccessToken = hasAccessToken;
        hasAccessToken = Boolean(accessToken);

        attachWindowListeners();

        if (!hasAccessToken) {
            stopped = false;
            clearTimer();
            setSnapshot(0);
        } else {
            if (!hadAccessToken) {
                stopped = false;
            }
            syncTimer();
            if (!isDocumentHidden()) {
                void refresh();
            }
        }

        return () => {
            activeConnections = Math.max(0, activeConnections - 1);

            const nextIntervalCount = (intervalUsage.get(intervalMs) ?? 1) - 1;
            if (nextIntervalCount > 0) {
                intervalUsage.set(intervalMs, nextIntervalCount);
            } else {
                intervalUsage.delete(intervalMs);
            }

            if (activeConnections === 0) {
                clearTimer();
                detachWindowListeners();
                inFlight = null;
            } else {
                syncTimer();
            }
        };
    };

    return {
        connect,
        getSnapshot: () => snapshot,
        subscribe: (listener: Listener) => {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
        refresh,
    };
}
