'use client';

import { useCallback } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import NotiveLogo from '@/components/ui/NotiveLogo';
import NotiveLoadingScreen from '@/components/ui/NotiveLoadingScreen';
import { useAuth } from '@/context/auth-context';
import LandingEmotionCheckIn from '@/components/marketing/LandingEmotionCheckIn';
import {
    OutcomeProofSection,
    QuietNotebookHero,
    RealStudentsRealMoves,
    quietNotebookPageStyle,
    quietNotebookPanelStyle,
} from '@/components/marketing/NotiveShowcase';
import { NOTIVE_VOICE } from '@/content/notive-voice';
import useTelemetry from '@/hooks/use-telemetry';
import { rememberLandingEvent } from '@/utils/landing-checkin';
import { isNativeCapacitorPlatform } from '@/utils/sso';
import useHasMounted from '@/hooks/use-has-mounted';

const HOME_LAUNCH_PHRASES = [
    'Opening your notebook\u2026',
    'Taking you back home\u2026',
    'Picking up where you left off\u2026',
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
        <main className="page-paper-canvas min-h-screen px-3 py-3 md:px-5 md:py-5" style={quietNotebookPageStyle}>
            <div className="mx-auto max-w-7xl">
                <QuietNotebookHero
                    onPrimaryCtaClick={() => trackHomepageCta('hero')}
                    onSecondaryCtaClick={() => rememberLandingEvent('homepage_secondary_cta_clicked', 'hero', { surface: 'homepage' })}
                />
                <LandingEmotionCheckIn />
                <RealStudentsRealMoves />
                <OutcomeProofSection />

                <motion.section
                    initial={{ opacity: 0, y: 18 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.2 }}
                    transition={{ duration: 0.45, ease: 'easeOut' }}
                    className="app-paper mt-8 rounded-[2rem] px-5 py-7 md:mt-10 md:px-8 md:py-9"
                    style={quietNotebookPanelStyle}
                >
                    <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                        <div className="max-w-2xl">
                            <NotiveLogo size="sm" variant="horizontal" />
                            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-[rgb(39,35,31)] md:text-[2.25rem]">
                                {NOTIVE_VOICE.home.closingTitle}
                            </h2>
                            <p className="mt-3 max-w-xl text-sm leading-7 text-[rgb(76,70,62)] md:text-base">
                                {NOTIVE_VOICE.home.closingBody}
                            </p>
                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row">
                            <Link
                                href="/register"
                                onClick={() => trackHomepageCta('closing')}
                                className="inline-flex items-center justify-center rounded-[1.2rem] px-5 py-3 text-sm font-semibold text-[rgb(34,32,29)] transition-transform hover:-translate-y-0.5"
                                style={{
                                    background: 'rgba(232, 223, 210, 0.96)',
                                    border: '1px solid rgba(122,112,98,0.24)',
                                }}
                            >
                                Create account
                            </Link>
                            <Link
                                href="/login"
                                onClick={() => rememberLandingEvent('homepage_secondary_cta_clicked', 'closing', { surface: 'homepage' })}
                                className="inline-flex items-center justify-center rounded-[1.2rem] px-5 py-3 text-sm font-medium text-[rgb(62,57,50)] transition-opacity hover:opacity-80"
                                style={{
                                    background: 'rgba(255,255,255,0.68)',
                                    border: '1px solid rgba(122,112,98,0.18)',
                                }}
                            >
                                Sign in
                            </Link>
                        </div>
                    </div>
                </motion.section>
            </div>
        </main>
    );
}
