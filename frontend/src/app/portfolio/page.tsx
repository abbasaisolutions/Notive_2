'use client';

import dynamic from 'next/dynamic';
import { Spinner } from '@/components/ui';

const PortfolioWorkspace = dynamic(() => import('@/components/portfolio/PortfolioWorkspace'), {
    ssr: false,
    loading: () => <div className="flex min-h-[60vh] items-center justify-center"><Spinner /></div>,
});

export default function PortfolioPage() {
    return <PortfolioWorkspace />;
}
