import type { Metadata } from 'next';
import { Suspense } from 'react';
import ProfileClient from '@/components/profile/ProfileClient';

export const metadata: Metadata = {
    title: 'Your Profile | Notive',
    description: 'Track your personal growth and stats.',
};

export default function ProfilePage() {
    return (
        <Suspense
            fallback={(
                <div className="min-h-screen flex items-center justify-center">
                    <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
                </div>
            )}
        >
            <ProfileClient />
        </Suspense>
    );
}
