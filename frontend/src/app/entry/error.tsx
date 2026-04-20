'use client';

import RouteErrorState from '@/components/error/RouteErrorState';

export default function EntryError({
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
            route="entry"
            title="This writing space glitched"
            message="Your draft is still recoverable. Try again and we’ll bring the studio back."
        />
    );
}
