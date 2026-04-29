import NotiveLoadingScreen from '@/components/ui/NotiveLoadingScreen';

const PROFILE_PHRASES = [
    'Loading your profile...',
    'Preparing your information...',
    'Getting things ready...',
];

export default function ProfileLoading() {
    return <NotiveLoadingScreen phrases={PROFILE_PHRASES} phraseInterval={2800} />;
}
