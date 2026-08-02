import NotiveLoadingScreen from '@/components/ui/NotiveLoadingScreen';

const PORTFOLIO_PHRASES = [
    'Loading your portfolio...',
    'Gathering your stories and evidence...',
    'Preparing your reusable moments...',
];

export default function PortfolioLoading() {
    return <NotiveLoadingScreen phrases={PORTFOLIO_PHRASES} phraseInterval={2800} />;
}
