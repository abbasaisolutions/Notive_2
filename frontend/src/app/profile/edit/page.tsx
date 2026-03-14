'use client';

import React, { Suspense } from 'react';
import { ProfileSettingsEditor } from '@/components/profile/edit/ProfileSettingsEditor';

export default function ProfileEditPage() {
    return (
        <Suspense
            fallback={(
                <div className="min-h-screen flex items-center justify-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                </div>
            )}
        >
            <ProfileSettingsEditor />
        </Suspense>
    );
}
