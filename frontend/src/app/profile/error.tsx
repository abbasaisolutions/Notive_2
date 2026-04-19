'use client';

import RouteErrorState from '@/components/error/RouteErrorState';

export default function ProfileError({
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
            route="profile"
            title="Your profile didn't settle in"
            message="Your settings are still safe. Try again and we’ll reload this space."
        />
    );
}
