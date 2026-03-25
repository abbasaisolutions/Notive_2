'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { useGamification } from '@/context/gamification-context';
import ProgressivePersonalizationPrompt from '@/components/smart/ProgressivePersonalizationPrompt';
import MobileNav from '@/components/layout/MobileNav';
import Sidebar from '@/components/layout/Sidebar';
import CelebrationModal from '@/components/gamification/CelebrationModal';
import FloatingVoiceButton from '@/components/voice/FloatingVoiceButton';
import { getWorkspaceMaturity, shouldHideGlobalNav } from '@/components/layout/nav-config';

export default function AppChrome() {
    const pathname = usePathname();
    const { user } = useAuth();
    const { stats, refreshStats } = useGamification();
    const hideNav = shouldHideGlobalNav(pathname);
    const hideAuxiliary = hideNav || pathname?.startsWith('/entry/new') || pathname?.startsWith('/entry/edit');
    const workspaceMaturity = getWorkspaceMaturity({
        role: user?.role ?? null,
        profile: user?.profile ?? null,
        totalEntries: stats?.totalEntries ?? 0,
    });
    const showCalmAuxiliary = workspaceMaturity !== 'new';

    useEffect(() => {
        if (user) {
            refreshStats();
        }
    }, [user, refreshStats]);

    return (
        <>
            {!hideNav && <Sidebar />}
            {!hideAuxiliary && (
                <>
                    <MobileNav />
                    {showCalmAuxiliary && <CelebrationModal />}
                    {showCalmAuxiliary && (
                        <div className="hidden md:block">
                            <FloatingVoiceButton />
                        </div>
                    )}
                    {showCalmAuxiliary && (
                        <div className="hidden md:block">
                            <ProgressivePersonalizationPrompt />
                        </div>
                    )}
                </>
            )}
        </>
    );
}
