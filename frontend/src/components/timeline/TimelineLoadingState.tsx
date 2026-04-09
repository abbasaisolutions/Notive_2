import NotiveLoadingScreen from '@/components/ui/NotiveLoadingScreen';
import { SkeletonCard } from '@/components/ui/SkeletonLoader';
import { quietNotebookPageStyle } from '@/components/marketing/NotiveShowcase';

const TIMELINE_LOADING_PHRASES = [
    'Opening your timeline...',
    'Laying your recent notes on the page...',
    'Following the thread back to now...',
];

export default function TimelineLoadingState() {
    return (
        <div className="page-paper-canvas min-h-screen px-3 py-3 pb-32 md:px-8 md:py-10 md:pb-20" style={quietNotebookPageStyle}>
            <main className="mx-auto w-full max-w-6xl space-y-5">
                <NotiveLoadingScreen
                    variant="inline"
                    phrases={TIMELINE_LOADING_PHRASES}
                    phraseInterval={3000}
                />

                <div className="mx-auto w-full max-w-4xl space-y-6 opacity-80">
                    <SkeletonCard />
                    <SkeletonCard />
                    <SkeletonCard />
                </div>
            </main>
        </div>
    );
}