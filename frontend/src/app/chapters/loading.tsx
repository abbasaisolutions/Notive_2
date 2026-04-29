import NotiveLoadingScreen from '@/components/ui/NotiveLoadingScreen';
import { SkeletonCard } from '@/components/ui/SkeletonLoader';

const CHAPTERS_PHRASES = [
    'Loading your chapters...',
    'Gathering your life areas...',
    'Organizing your stories...',
];

export default function ChaptersLoading() {
    return <NotiveLoadingScreen phrases={CHAPTERS_PHRASES} phraseInterval={2800} />;
}

// Fallback skeleton for client-side needs
function ChaptersSkeletonFallback() {
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
