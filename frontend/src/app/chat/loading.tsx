import Skeleton from '@/components/ui/SkeletonLoader';

export default function ChatLoading() {
    return (
        <div className="min-h-screen pb-32 md:pb-20">
            <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
                {/* Chat header skeleton */}
                <div className="mb-6">
                    <Skeleton className="h-8 w-48 mb-2" />
                    <Skeleton className="h-4 w-72" />
                </div>

                {/* Message bubbles skeleton */}
                <div className="space-y-4">
                    <div className="flex justify-end">
                        <Skeleton className="h-16 w-3/5 rounded-2xl" />
                    </div>
                    <div className="flex justify-start">
                        <Skeleton className="h-24 w-4/5 rounded-2xl" />
                    </div>
                    <div className="flex justify-end">
                        <Skeleton className="h-12 w-2/5 rounded-2xl" />
                    </div>
                </div>
            </main>
        </div>
    );
}
