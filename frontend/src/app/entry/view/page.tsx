import type { Metadata, ResolvingMetadata } from 'next';
import EntryDetailClient from '@/components/entry/EntryDetailClient';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

type Props = {
    searchParams: { [key: string]: string | string[] | undefined }
}

export async function generateMetadata(
    { searchParams }: Props,
    parent: ResolvingMetadata
): Promise<Metadata> {
    const id = searchParams.id as string;

    // Default title if no ID
    if (!id) return { title: 'Entry | Notive' };

    try {
        // Fetch data
        const product = await fetch(`${API_URL}/entries/${id}`).then((res) => res.json());

        return {
            title: `${product.entry?.title || 'Untitled Entry'} | Notive`,
        };
    } catch (e) {
        return {
            title: 'Entry | Notive',
        };
    }
}

export default function EntryDetailPage() {
    return <EntryDetailClient />;
}
