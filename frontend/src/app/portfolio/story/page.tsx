'use client';

import { Suspense } from 'react';
import PortfolioStoryView from '@/components/portfolio/PortfolioStoryView';
import { Spinner } from '@/components/ui';

export default function PortfolioStoryPage() {
    return (
        <Suspense
            fallback={(
                <div className="flex min-h-[60vh] items-center justify-center">
                    <Spinner size="lg" />
                </div>
            )}
        >
            <PortfolioStoryView />
        </Suspense>
    );
}
