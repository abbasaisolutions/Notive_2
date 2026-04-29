import NotiveLoadingScreen from '@/components/ui/NotiveLoadingScreen';

const NOTIFICATIONS_PHRASES = [
    'Loading your notifications...',
    'Fetching your messages...',
    'Getting updates ready...',
];

export default function NotificationsLoading() {
    return <NotiveLoadingScreen phrases={NOTIFICATIONS_PHRASES} phraseInterval={2800} />;
}
