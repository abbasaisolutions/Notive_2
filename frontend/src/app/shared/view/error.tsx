'use client';

import RouteErrorState from '@/components/error/RouteErrorState';

export default function SharedViewError({
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
            route="shared.view"
            title="This memory didn’t load"
            message="The shared memory is still safe on the other side. Try reopening the link in a moment."
        />
    );
}
