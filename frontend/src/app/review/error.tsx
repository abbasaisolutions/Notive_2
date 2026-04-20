'use client';

import RouteErrorState from '@/components/error/RouteErrorState';

export default function ReviewError({
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
            route="review"
            title="Your review page paused"
            message="Your patterns are still there. Try again and we’ll rebuild this recap."
        />
    );
}
