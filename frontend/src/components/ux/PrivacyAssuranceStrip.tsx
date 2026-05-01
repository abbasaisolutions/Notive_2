'use client';

import { FiLock, FiShield } from 'react-icons/fi';

type PrivacyAssuranceStripProps = {
    context?: 'draft' | 'saved' | 'insight';
    compact?: boolean;
};

const copy = {
    draft: {
        title: 'Private draft',
        body: 'Saved only for your workspace. You control when it becomes a memory.',
    },
    saved: {
        title: 'Saved privately',
        body: 'Only you can see this unless you choose to share it.',
    },
    insight: {
        title: 'Used for this read',
        body: 'Insights are based on your notes and stay inside your Notive workspace.',
    },
};

export default function PrivacyAssuranceStrip({ context = 'draft', compact = false }: PrivacyAssuranceStripProps) {
    const item = copy[context];

    return (
        <div
            className={`flex items-start gap-2 rounded-2xl border border-[rgba(var(--paper-border),0.42)] bg-[rgba(var(--paper-sage),0.07)] ${
                compact ? 'px-3 py-2' : 'px-3.5 py-3'
            }`}
        >
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                {context === 'insight' ? <FiShield size={14} aria-hidden /> : <FiLock size={14} aria-hidden />}
            </span>
            <span className="min-w-0">
                <span className="block text-xs font-semibold text-strong">{item.title}</span>
                <span className="block text-xs leading-5 text-muted">{item.body}</span>
            </span>
        </div>
    );
}
