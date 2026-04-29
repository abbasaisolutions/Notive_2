import NotiveLoadingScreen from '@/components/ui/NotiveLoadingScreen';

const TIMELINE_PHRASES = [
    'Loading your timeline...',
    'Gathering your memories...',
    'Organizing by time...',
];

export default function TimelineLoading() {
    return <NotiveLoadingScreen phrases={TIMELINE_PHRASES} phraseInterval={2800} />;
}
