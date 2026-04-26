import { Suspense } from 'react';
import EntriesByTagClient from './EntriesByTagClient';

function EntriesByTagFallback() {
    return (
        <div className="mx-auto max-w-3xl px-4 py-8">
            <div className="flex items-center justify-center py-16">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
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
