import { Suspense } from 'react';
import { Spinner } from '@/components/ui';
import EntriesByTagClient from './EntriesByTagClient';

function EntriesByTagFallback() {
    return (
        <div className="mx-auto max-w-3xl px-4 py-8">
            <div className="flex items-center justify-center py-16">
                <Spinner size="lg" />
            </div>
        </div>
    );
}

export default function EntriesByTagPage() {
    return (
        <Suspense fallback={<EntriesByTagFallback />}>
            <EntriesByTagClient />
        </Suspense>
    );
}
