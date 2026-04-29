import NotiveLoadingScreen from '@/components/ui/NotiveLoadingScreen';
import Skeleton from '@/components/ui/SkeletonLoader';

const REVIEW_PHRASES = [
    'Loading your review...',
    'Preparing reflections...',
    'Gathering insights...',
];

export default function ReviewLoading() {
    return <NotiveLoadingScreen phrases={REVIEW_PHRASES} phraseInterval={2800} />;
}

// Fallback skeleton for client-side needs
function ReviewSkeletonFallback() {
    return (
        <main className="min-h-screen bg-[rgb(var(--bg-canvas))] pb-[max(3rem,env(safe-area-inset-bottom))]">
            <div className="mx-auto w-full max-w-2xl px-5 pt-8">
                <div className="flex items-center justify-between gap-3">
                    <Skeleton className="h-6 w-24 rounded-full" />
                    <Skeleton className="h-10 w-44 rounded-full" />
                </div>

                <div className="mt-6 space-y-4">
                    <Skeleton className="h-4 w-28 rounded-full" />
                    <Skeleton className="h-10 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-11/12" />
                </div>

                <div className="mt-6 grid grid-cols-3 gap-3">
                    <Skeleton className="h-24 w-full rounded-2xl" />
                    <Skeleton className="h-24 w-full rounded-2xl" />
                    <Skeleton className="h-24 w-full rounded-2xl" />
                </div>

                <div className="mt-6 space-y-4">
                    <Skeleton className="h-28 w-full rounded-2xl" />
                    <Skeleton className="h-20 w-full rounded-2xl" />
                    <Skeleton className="h-20 w-full rounded-2xl" />
                    <Skeleton className="h-28 w-full rounded-2xl" />
                </div>
            </div>
        </main>
    );
}
