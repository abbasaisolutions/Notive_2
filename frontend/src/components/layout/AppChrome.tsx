'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { App as CapacitorApp } from '@capacitor/app';
import { Keyboard, KeyboardResize } from '@capacitor/keyboard';
import { StatusBar, Style as StatusBarStyle } from '@capacitor/status-bar';
import { useAuth } from '@/context/auth-context';
import { hapticTap } from '@/services/haptics.service';
import { useGamification } from '@/context/gamification-context';
import { isChipScrollerInteraction } from '@/components/layout/chip-scroller-haptics';
import ProgressivePersonalizationPrompt from '@/components/smart/ProgressivePersonalizationPrompt';
import MobileNav from '@/components/layout/MobileNav';
import NotificationBell from '@/components/layout/NotificationBell';
import Sidebar from '@/components/layout/Sidebar';
import CelebrationModal from '@/components/gamification/CelebrationModal';
import FloatingVoiceButton from '@/components/voice/FloatingVoiceButton';
import { getWorkspaceMaturity, shouldHideGlobalNav } from '@/components/layout/nav-config';
import { initSessionTracker } from '@/services/app-session-tracker.service';
import { API_URL } from '@/constants/config';
import { extractNativeAppPath } from '@/utils/native-app-links';
import { isNativeCapacitorPlatform } from '@/utils/sso';
import { resolveAuthenticatedPublicEntryDestination } from '@/utils/public-entry-routing';
import { getNativeBackHandler } from '@/utils/native-navigation';

export default function AppChrome() {
    const router = useRouter();
    const pathname = usePathname();
    const { user, accessToken, isLoading: authLoading } = useAuth();
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

    // Deep link handler (native only)
    useEffect(() => {
        if (!isNativeCapacitorPlatform()) {
            return;
        }

        if (authLoading || !user) {
            return;
        }

        const currentQuery = typeof window !== 'undefined' ? window.location.search : '';
        const destination = resolveAuthenticatedPublicEntryDestination(pathname, currentQuery, user);
        if (!destination) {
            return;
        }

        router.replace(destination);
    }, [authLoading, pathname, router, user]);

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

    // Android hardware back button handler (native only)
    useEffect(() => {
        if (!isNativeCapacitorPlatform()) {
            return;
        }

        const HOME_ROUTES = new Set(['/', '/dashboard']);
        let removed = false;
        let removeListener: (() => Promise<void>) | null = null;
        let isHandlingBackPress = false;

        void CapacitorApp.addListener('backButton', ({ canGoBack }) => {
            if (isHandlingBackPress) {
                return;
            }

            isHandlingBackPress = true;

            void (async () => {
                try {
                    const nativeBackHandler = getNativeBackHandler();
                    if (nativeBackHandler && await nativeBackHandler()) {
                        return;
                    }

                    if (canGoBack && !HOME_ROUTES.has(window.location.pathname)) {
                        router.back();
                    } else {
                        await CapacitorApp.minimizeApp();
                    }
                } finally {
                    window.setTimeout(() => {
                        isHandlingBackPress = false;
                    }, 180);
                }
            })();
        }).then((listener) => {
            if (removed) {
                void listener.remove();
                return;
            }
            removeListener = () => listener.remove();
        }).catch(() => {
            // No-op on web
        });

        return () => {
            removed = true;
            if (removeListener) {
                void removeListener();
            }
        };
    }, [router]);

    // Delegated haptic feedback for chip-scroller clicks. Using `click` keeps
    // swipe-to-scroll gestures from buzzing at touch-start.
    useEffect(() => {
        if (typeof document === 'undefined') return;

        const handler = (event: MouseEvent) => {
            if (!isChipScrollerInteraction(event.target)) return;
            hapticTap();
        };

        document.addEventListener('click', handler);
        return () => {
            document.removeEventListener('click', handler);
        };
    }, []);

    // StatusBar + Keyboard configuration (native only)
    useEffect(() => {
        if (!isNativeCapacitorPlatform()) return;

        // Paper-theme status bar: dark text on light background
        void StatusBar.setStyle({ style: StatusBarStyle.Light }).catch(() => {});
        void StatusBar.setBackgroundColor({ color: '#F8F4ED' }).catch(() => {});

        // Keyboard: resize body so inputs are not obscured
        void Keyboard.setResizeMode({ mode: KeyboardResize.Body }).catch(() => {});
        void Keyboard.setScroll({ isDisabled: false }).catch(() => {});
    }, []);

    useEffect(() => {
        if (!isNativeCapacitorPlatform() || typeof window === 'undefined' || !window.visualViewport) {
            return;
        }

        const root = document.documentElement;
        const visualViewport = window.visualViewport;
        let animationFrameId = 0;

        const getFocusedEditable = () => {
            const activeElement = document.activeElement;
            if (!(activeElement instanceof HTMLElement)) {
                return null;
            }

            if (activeElement.matches('input, textarea, [contenteditable="true"], [contenteditable=""], .ProseMirror')) {
                return activeElement;
            }

            const editableParent = activeElement.closest?.('input, textarea, [contenteditable="true"], [contenteditable=""], .ProseMirror');
            return editableParent instanceof HTMLElement ? editableParent : null;
        };

        const syncViewportInsets = () => {
            const keyboardInset = Math.max(
                Math.round(window.innerHeight - visualViewport.height - visualViewport.offsetTop),
                0,
            );
            root.style.setProperty('--keyboard-inset', `${keyboardInset}px`);

            const focusedEditable = getFocusedEditable();
            if (!focusedEditable || keyboardInset < 96) {
                return;
            }

            const visibleBottom = visualViewport.offsetTop + visualViewport.height - 28;
            const focusedRect = focusedEditable.getBoundingClientRect();

            if (focusedRect.bottom > visibleBottom || focusedRect.top < visualViewport.offsetTop + 16) {
                focusedEditable.scrollIntoView({
                    block: 'center',
                    inline: 'nearest',
                    behavior: 'smooth',
                });
            }
        };

        const scheduleViewportSync = () => {
            if (animationFrameId) {
                window.cancelAnimationFrame(animationFrameId);
            }

            animationFrameId = window.requestAnimationFrame(() => {
                animationFrameId = 0;
                syncViewportInsets();
            });
        };

        const handleFocusIn = () => {
            window.setTimeout(scheduleViewportSync, 60);
        };

        visualViewport.addEventListener('resize', scheduleViewportSync);
        visualViewport.addEventListener('scroll', scheduleViewportSync);
        window.addEventListener('focusin', handleFocusIn);
        document.addEventListener('selectionchange', scheduleViewportSync);
        scheduleViewportSync();

        return () => {
            visualViewport.removeEventListener('resize', scheduleViewportSync);
            visualViewport.removeEventListener('scroll', scheduleViewportSync);
            window.removeEventListener('focusin', handleFocusIn);
            document.removeEventListener('selectionchange', scheduleViewportSync);
            if (animationFrameId) {
                window.cancelAnimationFrame(animationFrameId);
            }
            root.style.removeProperty('--keyboard-inset');
        };
    }, []);

    return (
        <>
            {!hideNav && <Sidebar />}
            {!hideAuxiliary && (
                <>
                    <NotificationBell />
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
                </>
            )}
        </>
    );
}
