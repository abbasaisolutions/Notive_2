'use client';

import { usePathname } from 'next/navigation';
import ProgressivePersonalizationPrompt from '@/components/smart/ProgressivePersonalizationPrompt';
import MobileNav from '@/components/layout/MobileNav';
import Sidebar from '@/components/layout/Sidebar';
import CelebrationModal from '@/components/gamification/CelebrationModal';
import FloatingVoiceButton from '@/components/voice/FloatingVoiceButton';
import { shouldHideGlobalNav } from '@/components/layout/nav-config';

export default function AppChrome() {
    const pathname = usePathname();
    const hideNav = shouldHideGlobalNav(pathname);
    const hideAuxiliary = hideNav || pathname?.startsWith('/entry/new') || pathname?.startsWith('/entry/edit');

    return (
        <>
            {!hideNav && <Sidebar />}
            {!hideAuxiliary && (
                <>
                    <MobileNav />
                    <CelebrationModal />
                    <div className="hidden md:block">
                        <FloatingVoiceButton />
                    </div>
                    <div className="hidden md:block">
                        <ProgressivePersonalizationPrompt />
                    </div>
                </>
            )}
        </>
    );
}
