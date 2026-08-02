import NotiveLoadingScreen from '@/components/ui/NotiveLoadingScreen';

const IMPORT_PHRASES = [
    'Loading your import tools...',
    'Getting ready to bring in memories...',
];

export default function ImportLoading() {
    return <NotiveLoadingScreen phrases={IMPORT_PHRASES} phraseInterval={2800} />;
}
