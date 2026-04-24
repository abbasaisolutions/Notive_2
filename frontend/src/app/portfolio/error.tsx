'use client';

import RouteErrorState from '@/components/error/RouteErrorState';

export default function PortfolioError({
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
            route="portfolio"
            title="Your portfolio didn’t load"
            message="Your stories are still intact. Pull the page back up and we’ll rebuild the view."
        />
    );
}
