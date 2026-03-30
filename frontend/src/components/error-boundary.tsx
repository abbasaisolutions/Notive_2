'use client';

import React from 'react';
import logger from '@/utils/logger';

interface ErrorBoundaryProps {
    children: React.ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

/**
 * Error Boundary component for catching and displaying errors
 * Prevents entire app from crashing on unhandled errors
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
        };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return {
            hasError: true,
            error,
        };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        // Log error to monitoring service
        logger.error('ErrorBoundary caught:', {
            message: error.message,
            stack: error.stack,
            componentStack: errorInfo.componentStack,
        });

        // Optional: Send to error tracking service (Sentry, etc.)
        // if (process.env.NODE_ENV === 'production') {
        //     Sentry.captureException(error, { contexts: { react: errorInfo } });
        // }
    }

    handleReset = () => {
        this.setState({
            hasError: false,
            error: null,
        });

        // Optionally reload the page
        // window.location.reload();
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center min-h-screen p-4 gap-6">
                    {/* Icon */}
                    <div className="h-16 w-16 rounded-full bg-[rgb(var(--danger))]/10 flex items-center justify-center">
                        <svg
                            className="h-8 w-8 text-[rgb(var(--danger))]"
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

                    {/* Error Message */}
                    <div className="text-center max-w-md">
                        <h1 className="text-2xl font-bold mb-2 text-[rgb(var(--text-primary))]">
                            Something went wrong
                        </h1>
                        <p className="text-ink-secondary mb-4">
                            We encountered an unexpected error. The app has been paused to prevent further issues.
                        </p>

                        {/* Error Details (Development only) */}
                        {process.env.NODE_ENV === 'development' && this.state.error && (
                            <details className="mt-4 p-3 bg-[rgb(var(--danger))]/10 rounded-lg text-left text-sm">
                                <summary className="cursor-pointer font-mono text-[rgb(var(--danger))]">
                                    Error details
                                </summary>
                                <div className="mt-2 space-y-1 font-mono text-xs text-[rgb(var(--danger))]/80 overflow-auto max-h-40">
                                    <div>
                                        <strong>Message:</strong> {this.state.error.message}
                                    </div>
                                    {this.state.error.stack && (
                                        <pre className="whitespace-pre-wrap break-words">{this.state.error.stack}</pre>
                                    )}
                                </div>
                            </details>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3">
                        <button
                            onClick={this.handleReset}
                            className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-white font-medium rounded-lg transition-colors"
                        >
                            Try again
                        </button>
                        <button
                            onClick={() => (window.location.href = '/')}
                            className="px-6 py-2.5 workspace-button-outline font-medium rounded-lg transition-colors"
                        >
                            Go to home
                        </button>
                    </div>

                    {/* Support Message */}
                    <p className="text-sm text-ink-muted mt-4">
                        If this keeps happening,{' '}
                        <a
                            href="mailto:support@notive.com"
                            className="text-primary hover:underline"
                        >
                            contact support
                        </a>
                    </p>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
