import React from 'react';
import Link from 'next/link';
import { NotebookDoodle } from '@/components/dashboard/NotebookDoodles';
import type { NotebookDoodleName, NotebookAccentName } from '@/components/dashboard/NotebookDoodles';

interface EmptyStateProps {
    icon?: React.ReactNode;
    /** Use a notebook doodle instead of the generic inbox icon */
    doodle?: NotebookDoodleName;
    doodleAccent?: NotebookAccentName;
    title: string;
    /** Body text (also accepted as `description` for backwards compatibility) */
    subtitle?: string;
    description?: string;
    /** Structured action object */
    action?: {
        label: string;
        href?: string;
        onClick?: () => void;
    };
    /** Shorthand props for a simple link action (backwards compatible with surface.EmptyState) */
    actionLabel?: string;
    actionHref?: string;
    className?: string;
}

export function EmptyState({
    icon,
    doodle,
    doodleAccent = 'sage',
    title,
    subtitle,
    description,
    action,
    actionLabel,
    actionHref,
    className = '',
}: EmptyStateProps) {
    const body = subtitle ?? description;
    const resolvedAction = action ?? (actionLabel && actionHref ? { label: actionLabel, href: actionHref } : undefined);

    return (
        <div
            className={`
                flex flex-col items-center justify-center
                py-16 px-4 gap-4 text-center
                ${className}
            `}
        >
            {icon ? (
                <div className="text-6xl opacity-60">{icon}</div>
            ) : doodle ? (
                <NotebookDoodle name={doodle} accent={doodleAccent} className="opacity-70" />
            ) : (
                <svg
                    className="h-16 w-16 text-ink-muted opacity-40"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1}
                        d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                    />
                </svg>
            )}

            <div>
                <h3 className="text-lg font-semibold text-strong mb-1">{title}</h3>
                {body && <p className="text-ink-secondary text-sm max-w-sm">{body}</p>}
            </div>

            {resolvedAction && (
                <div className="mt-2">
                    {resolvedAction.href ? (
                        <Link
                            href={resolvedAction.href}
                            className="inline-flex items-center rounded-xl border border-primary/30 bg-primary/12 px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-primary hover:bg-primary/20 transition-colors"
                        >
                            {resolvedAction.label}
                        </Link>
                    ) : (
                        <button
                            type="button"
                            onClick={resolvedAction.onClick}
                            className="workspace-button-outline rounded-xl px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] transition-colors"
                        >
                            {resolvedAction.label}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
