'use client';

import RouteErrorState from '@/components/error/RouteErrorState';

export default function EntryNewError({
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
            route="entry-new"
            title="The editor didn't open"
            message="Any text you typed is saved as a draft on this device. Try reopening the entry."
        />
    );
}
