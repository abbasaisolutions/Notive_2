import { SkeletonCard } from '@/components/ui/SkeletonLoader';

export default function ChaptersLoading() {
    return (
        <div className="min-h-screen pb-32 md:pb-20">
            <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
                <div className="space-y-6">
                    <SkeletonCard />
                    <SkeletonCard />
                    <SkeletonCard />
                </div>
            </main>
        </div>
    );
}
