'use client';

import RouteErrorState from '@/components/error/RouteErrorState';

export default function DashboardError({
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
            route="dashboard"
            title="Couldn't load the dashboard"
            message="Your entries are safe — refresh to try again."
        />
    );
}
