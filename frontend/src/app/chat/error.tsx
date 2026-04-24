'use client';

import RouteErrorState from '@/components/error/RouteErrorState';

export default function ChatError({
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
            route="chat"
            title="The conversation paused"
            message="We couldn’t reach the reflection chat just now. Pull it back up and we’ll pick up where you left off."
        />
    );
}
