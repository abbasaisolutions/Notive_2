import type { Metadata } from 'next';
import { Suspense } from 'react';
import ProfileClient from '@/components/profile/ProfileClient';
import { Spinner } from '@/components/ui';

export const metadata: Metadata = {
    title: 'Me | Notive',
    description: 'Your profile, goals, and privacy settings.',
};

export default function ProfilePage() {
    return (
        <Suspense
            fallback={(
                <div className="min-h-screen flex items-center justify-center">
                    <Spinner size="md" />
                </div>
            )}
        >
            <ProfileClient />
        </Suspense>
    );
}
