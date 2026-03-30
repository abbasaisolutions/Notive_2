'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FiArrowRight, FiClock } from 'react-icons/fi';
import { readWorkspaceResume, type WorkspaceResumeState } from '@/utils/workspace-resume';
import { journeyStages } from '@/components/layout/nav-config';
import useTelemetry from '@/hooks/use-telemetry';

const formatRelativeTime = (value: string) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'recently';

    const deltaMs = Date.now() - parsed.getTime();
    const deltaMinutes = Math.max(Math.round(deltaMs / 60000), 0);
    if (deltaMinutes < 1) return 'just now';
    if (deltaMinutes < 60) return `${deltaMinutes}m ago`;

    const deltaHours = Math.round(deltaMinutes / 60);
    if (deltaHours < 24) return `${deltaHours}h ago`;

    const deltaDays = Math.round(deltaHours / 24);
    if (deltaDays < 7) return `${deltaDays}d ago`;

    return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export default function WorkspaceResumeCard({
    currentReturnTo,
    pathname,
    className,
}: {
    currentReturnTo: string;
    pathname: string | null | undefined;
    className?: string;
}) {
    const [session, setSession] = useState<WorkspaceResumeState | null>(null);
    const { trackEvent } = useTelemetry();

    useEffect(() => {
        setSession(readWorkspaceResume());
    }, [currentReturnTo, pathname]);

    if (!session || session.href === currentReturnTo) return null;
    if (pathname?.startsWith('/timeline') || pathname?.startsWith('/portfolio')) return null;

    const stage = journeyStages.find((item) => item.id === session.stage);

    return (
        <section className={`workspace-soft-panel rounded-2xl p-3 ${className || ''}`} aria-label="Resume last workspace">
            <div className="mb-2 flex items-center justify-between gap-2">
                <div className="type-overline inline-flex items-center gap-2 text-muted">
                    <FiClock size={12} aria-hidden="true" />
                    Resume Journey
                </div>
                {stage && (
                    <span className="type-micro text-soft">
                        {stage.label}
                    </span>
                )}
            </div>
            <p className="type-card-title text-strong">{session.title}</p>
            <p className="type-body-sm mt-1 text-default">{session.summary}</p>
            <div className="mt-3 flex items-center justify-between gap-3">
                <span className="type-micro text-muted">
                    {formatRelativeTime(session.updatedAt)}
                </span>
                <Link
                    href={session.href}
                    onClick={() => {
                        void trackEvent({
                            eventType: 'resume_journey',
                            value: session.key,
                            metadata: {
                                title: session.title,
                                stage: session.stage,
                            },
                        });
                    }}
                    className="workspace-button-primary type-label-sm inline-flex items-center gap-2 rounded-xl px-3 py-2 transition-colors hover:bg-primary/20"
                >
                    {session.actionLabel || 'Resume'}
                    <FiArrowRight size={13} aria-hidden="true" />
                </Link>
            </div>
        </section>
    );
}
