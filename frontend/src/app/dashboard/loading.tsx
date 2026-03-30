import { SkeletonCard, SkeletonStat } from '@/components/ui/SkeletonLoader';

export default function DashboardLoading() {
    return (
        <div className="min-h-screen pb-32 md:pb-20">
            <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
                {/* Stats row */}
                <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <SkeletonStat />
                    <SkeletonStat />
                    <SkeletonStat />
                    <SkeletonStat />
                </div>

                {/* Entry cards */}
                <div className="space-y-6">
                    <SkeletonCard />
                    <SkeletonCard />
                    <SkeletonCard />
                </div>
            </main>
        </div>
    );
}
