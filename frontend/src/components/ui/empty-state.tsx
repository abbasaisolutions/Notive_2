import React from 'react';
import { NotebookDoodle } from '@/components/dashboard/NotebookDoodles';
import type { NotebookDoodleName, NotebookAccentName } from '@/components/dashboard/NotebookDoodles';

interface EmptyStateProps {
    icon?: React.ReactNode;
    /** Use a notebook doodle instead of the generic inbox icon */
    doodle?: NotebookDoodleName;
    doodleAccent?: NotebookAccentName;
    title: string;
    subtitle?: string;
    action?: {
        label: string;
        href?: string;
        onClick?: () => void;
    };
    className?: string;
}

export function EmptyState({
    icon,
    doodle,
    doodleAccent = 'sage',
    title,
    subtitle,
    action,
    className = '',
}: EmptyStateProps) {
    return (
        <div
            className={`
                flex flex-col items-center justify-center
                py-16 px-4 gap-4
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

            <div className="text-center">
                <h3 className="text-lg font-semibold text-[rgb(var(--text-primary))] mb-1">{title}</h3>
                {subtitle && <p className="text-ink-secondary text-sm max-w-sm">{subtitle}</p>}
            </div>

            {action && (
                <div className="mt-4">
                    {action.href ? (
                        <a
                            href={action.href}
                            className="workspace-button-primary inline-flex rounded-xl px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] transition-colors"
                        >
                            {action.label}
                        </a>
                    ) : (
                        <button
                            onClick={action.onClick}
                            className="workspace-button-outline rounded-xl px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] transition-colors"
                        >
                            {action.label}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
