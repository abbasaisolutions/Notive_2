'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { App as CapacitorApp } from '@capacitor/app';
import { useAuth } from '@/context/auth-context';
import { useGamification } from '@/context/gamification-context';
import ProgressivePersonalizationPrompt from '@/components/smart/ProgressivePersonalizationPrompt';
import MobileNav from '@/components/layout/MobileNav';
import Sidebar from '@/components/layout/Sidebar';
import CelebrationModal from '@/components/gamification/CelebrationModal';
import FloatingVoiceButton from '@/components/voice/FloatingVoiceButton';
import PushNotificationPermissionPrompt from '@/components/push-notification-permission-prompt';
import { getWorkspaceMaturity, shouldHideGlobalNav } from '@/components/layout/nav-config';
import { initSessionTracker } from '@/services/app-session-tracker.service';
import { API_URL } from '@/constants/config';
import { extractNativeAppPath } from '@/utils/native-app-links';
import { isNativeCapacitorPlatform } from '@/utils/sso';

export default function AppChrome() {
    const router = useRouter();
    const pathname = usePathname();
    const { user, accessToken } = useAuth();
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

    // Initialize session tracker once when user is available
    useEffect(() => {
        if (!user) return;
        initSessionTracker(API_URL, () => {
            return accessToken;
        });
    }, [user, accessToken]);

    useEffect(() => {
        if (!isNativeCapacitorPlatform()) {
            return;
        }

        let removed = false;
        let removeListener: (() => Promise<void>) | null = null;

        void CapacitorApp.addListener('appUrlOpen', ({ url }) => {
            const nextPath = extractNativeAppPath(url);
            if (nextPath) {
                router.push(nextPath);
            }
        }).then((listener) => {
            if (removed) {
                void listener.remove();
                return;
            }

            removeListener = () => listener.remove();
        }).catch(() => {
            // No-op: web and unsupported shells do not need deep-link listeners.
        });

        return () => {
            removed = true;
            if (removeListener) {
                void removeListener();
            }
        };
    }, [router]);

    return (
        <>
            {!hideNav && <Sidebar />}
            {!hideAuxiliary && (
                <>
                    <MobileNav />
                    {showCalmAuxiliary && <CelebrationModal />}
                    {showCalmAuxiliary && (
                        <div className="hidden lg:block">
                            <FloatingVoiceButton />
                        </div>
                    )}
                    {showCalmAuxiliary && (
                        <div className="hidden lg:block">
                            <ProgressivePersonalizationPrompt />
                        </div>
                    )}
                    <PushNotificationPermissionPrompt />
                </>
            )}
        </>
    );
}
