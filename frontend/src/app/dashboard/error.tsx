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
            title="Your dashboard didn't load"
            message="A gentle refresh usually fixes this. Your entries are safe."
        />
    );
}
