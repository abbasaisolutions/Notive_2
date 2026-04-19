'use client';

import RouteErrorState from '@/components/error/RouteErrorState';

export default function TimelineError({
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
            route="timeline"
            title="Your timeline drifted off course"
            message="The memory trail is still here. Give it another pull and we’ll rebuild the view."
        />
    );
}
