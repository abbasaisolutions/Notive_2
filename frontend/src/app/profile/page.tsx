import type { Metadata } from 'next';
import ProfileClient from '@/components/profile/ProfileClient';

export const metadata: Metadata = {
    title: 'Your Profile | Notive',
    description: 'Track your personal growth and stats.',
};

export default function ProfilePage() {
    return <ProfileClient />;
}
