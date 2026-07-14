'use client';

import { useCallback } from 'react';
import NotiveLoadingScreen from '@/components/ui/NotiveLoadingScreen';
import { useAuth } from '@/context/auth-context';
import {
    QuietNotebookHero,
    quietNotebookPageStyle,
} from '@/components/marketing/NotiveShowcase';
import useTelemetry from '@/hooks/use-telemetry';
import { rememberLandingEvent } from '@/utils/landing-checkin';
import { isNativeCapacitorPlatform } from '@/utils/sso';
import useHasMounted from '@/hooks/use-has-mounted';

const HOME_LAUNCH_PHRASES = [
    'Opening your notebook…',
    'Taking you back home…',
    'Picking up where you left off…',
];

export default function HomePage() {
    const { user, isLoading: authLoading } = useAuth();
    const { trackEvent } = useTelemetry();
    const hasMounted = useHasMounted();
    const shouldHoldNativeHome = hasMounted && isNativeCapacitorPlatform() && (authLoading || !!user);

    const trackHomepageCta = useCallback((value: string) => {
        rememberLandingEvent('homepage_primary_cta_clicked', value, {
            surface: 'homepage',
        });

        if (user) {
            void trackEvent({
                eventType: 'homepage_primary_cta_clicked',
                value,
                metadata: { surface: 'homepage' },
            });
        }
    }, [trackEvent, user]);

    if (shouldHoldNativeHome) {
        return (
            <main className="page-paper-canvas min-h-screen" style={quietNotebookPageStyle}>
                <NotiveLoadingScreen phrases={HOME_LAUNCH_PHRASES} phraseInterval={3000} />
            </main>
        );
    }

    return (
        <main
            className="page-paper-canvas flex min-h-screen items-center px-3 py-3 md:px-5 md:py-5"
            style={quietNotebookPageStyle}
        >
            <div className="mx-auto w-full max-w-5xl">
                <QuietNotebookHero
                    onPrimaryCtaClick={() => trackHomepageCta('hero')}
                    onSecondaryCtaClick={() => rememberLandingEvent('homepage_secondary_cta_clicked', 'hero', { surface: 'homepage' })}
                />
            </div>
        </main>
    );
}
