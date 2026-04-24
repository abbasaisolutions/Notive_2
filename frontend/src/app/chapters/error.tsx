'use client';

import RouteErrorState from '@/components/error/RouteErrorState';

export default function ChaptersError({
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
            route="chapters"
            title="Your groups didn’t load"
            message="The shelf is still here. Give it another pull and we’ll line the groups back up."
        />
    );
}
