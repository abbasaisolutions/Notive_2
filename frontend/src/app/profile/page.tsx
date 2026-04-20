import type { Metadata } from 'next';
import { Suspense } from 'react';
import ProfileClient from '@/components/profile/ProfileClient';
import ProfileLoading from './loading';

export const metadata: Metadata = {
    title: 'Me | Notive',
    description: 'Your profile, goals, and privacy settings.',
};

export default function ProfilePage() {
    return (
        <Suspense
            fallback={<ProfileLoading />}
        >
            <ProfileClient />
        </Suspense>
    );
}
