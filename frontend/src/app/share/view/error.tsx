'use client';

import RouteErrorState from '@/components/error/RouteErrorState';

export default function ShareViewError({
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
            route="share.view"
            title="This share didn’t open"
            message="The shared note is still on the sender’s side. Try the link again in a moment."
        />
    );
}
