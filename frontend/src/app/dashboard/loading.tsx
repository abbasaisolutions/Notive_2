import NotiveLoadingScreen from '@/components/ui/NotiveLoadingScreen';

const DASHBOARD_PHRASES = [
    'Loading your dashboard...',
    'Fetching your insights...',
    'Preparing your overview...',
];

export default function DashboardLoading() {
    return <NotiveLoadingScreen phrases={DASHBOARD_PHRASES} phraseInterval={2800} />;
}
