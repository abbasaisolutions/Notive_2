'use client';

import React, { Suspense } from 'react';
import { ProfileSettingsEditor } from '@/components/profile/edit/ProfileSettingsEditor';
import NotiveLoadingScreen from '@/components/ui/NotiveLoadingScreen';

const PROFILE_EDIT_PHRASES = [
    'Loading your profile...',
    'Preparing your settings...',
    'Gathering your preferences...',
];

export default function ProfileEditPage() {
    return (
        <Suspense
            fallback={<NotiveLoadingScreen phrases={PROFILE_EDIT_PHRASES} phraseInterval={2800} />}
        >
            <ProfileSettingsEditor />
        </Suspense>
    );
}
