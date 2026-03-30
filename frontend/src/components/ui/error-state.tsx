import React from 'react';
import { Spinner } from './spinner';

interface ErrorStateProps {
    icon?: React.ReactNode;
    title: string;
    message: string;
    action?: {
        label: string;
        onClick: () => void;
        loading?: boolean;
    };
    variant?: 'compact' | 'full-page';
    className?: string;
}

export function ErrorState({
    icon,
    title,
    message,
    action,
    variant = 'compact',
    className = '',
}: ErrorStateProps) {
    if (variant === 'full-page') {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 gap-6">
                {icon ? (
                    <div className="h-16 w-16 rounded-full bg-danger/10 flex items-center justify-center text-danger text-3xl">
                        {icon}
                    </div>
                ) : (
                    <div className="h-16 w-16 rounded-full bg-danger/10 flex items-center justify-center">
                        <svg
                            className="h-8 w-8 text-danger"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1.5}
                                d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                        </svg>
                    </div>
                )}

                <div className="text-center max-w-md">
                    <h2 className="text-2xl font-bold mb-2 text-[rgb(var(--text-primary))]">{title}</h2>
                    <p className="text-ink-secondary">{message}</p>
                </div>

                {action && (
                    <button
                        onClick={action.onClick}
                        disabled={action.loading}
                        className="flex items-center justify-center gap-2 workspace-button-primary rounded-xl px-6 py-2.5 text-sm font-semibold uppercase tracking-[0.08em] transition-colors disabled:opacity-50"
                    >
                        {action.loading && <Spinner size="sm" variant="white" />}
                        {action.label}
                    </button>
                )}
            </div>
        );
    }

    // Compact variant
    return (
        <div
            className={`
                workspace-soft-panel rounded-2xl border border-danger/25 p-4
                flex gap-4 items-start
                ${className}
            `}
        >
            {icon ? (
                <div className="text-danger text-xl flex-shrink-0 mt-0.5">{icon}</div>
            ) : (
                <svg
                    className="h-5 w-5 text-danger flex-shrink-0 mt-0.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                </svg>
            )}

            <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-[rgb(var(--text-primary))] mb-0.5">{title}</h3>
                <p className="text-ink-secondary text-sm">{message}</p>
            </div>

            {action && (
                <button
                    onClick={action.onClick}
                    disabled={action.loading}
                    className="flex-shrink-0 workspace-button-outline rounded-xl px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] transition-colors disabled:opacity-50"
                >
                    {action.loading && <Spinner size="sm" />}
                    {action.label}
                </button>
            )}
        </div>
    );
}
