import NotiveLoadingScreen from '@/components/ui/NotiveLoadingScreen';

const TAGS_PHRASES = [
    'Loading your tags...',
    'Gathering your themes...',
];

export default function TagsLoading() {
    return <NotiveLoadingScreen phrases={TAGS_PHRASES} phraseInterval={2800} />;
}
