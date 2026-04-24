import NotiveLoadingScreen from '@/components/ui/NotiveLoadingScreen';
import { SkeletonCard, SkeletonStat } from '@/components/ui/SkeletonLoader';

const PORTFOLIO_LOADING_PHRASES = [
    'Pulling your stories into focus...',
    'Reviewing evidence across your notes...',
    'Laying out your growth so far...',
];

export default function PortfolioLoadingState() {
    return (
        <div className="min-h-screen px-4 py-6 md:px-8 md:py-8">
            <main className="mx-auto w-full max-w-6xl space-y-6">
                <NotiveLoadingScreen
                    variant="inline"
                    phrases={PORTFOLIO_LOADING_PHRASES}
                    phraseInterval={3000}
                />

                <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3 opacity-80">
                    <SkeletonStat />
                    <SkeletonStat />
                    <SkeletonStat />
                    <SkeletonStat />
                </div>

                <div className="space-y-4 opacity-70">
                    <SkeletonCard />
                    <SkeletonCard />
                </div>
            </main>
        </div>
    );
}
