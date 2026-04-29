import NotiveLoadingScreen from '@/components/ui/NotiveLoadingScreen';

const NEW_ENTRY_PHRASES = [
    'Creating a new entry...',
    'Preparing your canvas...',
    'Getting ready to write...',
];

export default function NewEntryLoading() {
    return <NotiveLoadingScreen phrases={NEW_ENTRY_PHRASES} phraseInterval={2800} />;
}
