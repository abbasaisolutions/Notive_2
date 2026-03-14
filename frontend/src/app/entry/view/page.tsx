import type { Metadata } from 'next';
import EntryDetailClient from '@/components/entry/EntryDetailClient';

export const metadata: Metadata = {
    title: 'Entry Details | Notive',
};

export default function EntryDetailPage() {
    return <EntryDetailClient />;
}

