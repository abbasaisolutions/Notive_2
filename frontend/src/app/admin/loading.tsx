import NotiveLoadingScreen from '@/components/ui/NotiveLoadingScreen';

const ADMIN_PHRASES = [
    'Loading the admin console...',
    'Gathering system signals...',
];

export default function AdminLoading() {
    return <NotiveLoadingScreen phrases={ADMIN_PHRASES} phraseInterval={2800} />;
}
