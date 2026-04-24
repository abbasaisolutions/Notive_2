'use client';

import RouteErrorState from '@/components/error/RouteErrorState';

export default function NotificationsError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <RouteErrorState
            error={error}
            reset={reset}
            route="notifications"
            title="Your inbox didn’t load"
            message="We couldn’t fetch your notifications just now. Try again in a moment."
        />
    );
}
