'use client';

import React, { Suspense } from 'react';
import { ProfileSettingsEditor } from '@/components/profile/edit/ProfileSettingsEditor';
import { Spinner } from '@/components/ui';

export default function ProfileEditPage() {
    return (
        <Suspense
            fallback={(
                <div className="min-h-screen flex items-center justify-center">
                    <Spinner size="md" />
                </div>
            )}
        >
            <ProfileSettingsEditor />
        </Suspense>
    );
}
