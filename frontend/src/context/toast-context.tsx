'use client';

import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info' | 'notification';

export interface Toast {
    id: string;
    title: string;
    description?: string;
    variant: ToastVariant;
    duration?: number;
    action?: {
        label: string;
        onClick: () => void;
    };
}

interface ToastContextType {
    toasts: Toast[];
    addToast: (toast: Omit<Toast, 'id'>) => string;
    removeToast: (id: string) => void;
    success: (title: string, description?: string) => string;
    error: (title: string, description?: string) => string;
    warning: (title: string, description?: string) => string;
    info: (title: string, description?: string) => string;
    undo: (title: string, onUndo: () => void, description?: string) => string;
    notification: (title: string, description?: string, action?: Toast['action']) => string;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

/**
 * Toast Provider - manages global toast notifications
 */
export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
        const id = `toast-${Date.now()}`;
        const newToast: Toast = {
            ...toast,
            id,
            duration: toast.duration ?? 5000,
        };

        setToasts(prev => [newToast, ...prev]);

        // Auto-remove after duration (unless manually dismissed)
        if (newToast.duration && newToast.duration > 0) {
            setTimeout(() => {
                removeToast(id);
            }, newToast.duration);
        }

        return id;
    }, [removeToast]);

    const success = useCallback(
        (title: string, description?: string) =>
            addToast({ title, description, variant: 'success' }),
        [addToast]
    );

    const error = useCallback(
        (title: string, description?: string) =>
            addToast({ title, description, variant: 'error' }),
        [addToast]
    );

    const warning = useCallback(
        (title: string, description?: string) =>
            addToast({ title, description, variant: 'warning' }),
        [addToast]
    );

    const info = useCallback(
        (title: string, description?: string) =>
            addToast({ title, description, variant: 'info' }),
        [addToast]
    );

    const undo = useCallback(
        (title: string, onUndo: () => void, description?: string) =>
            addToast({
                title,
                description,
                variant: 'notification',
                duration: 8000,
                action: { label: 'Undo', onClick: onUndo },
            }),
        [addToast]
    );

    const notification = useCallback(
        (title: string, description?: string, action?: Toast['action']) =>
            addToast({ title, description, variant: 'notification', duration: 7000, action }),
        [addToast]
    );

    const value = useMemo(() => ({
        toasts,
        addToast,
        removeToast,
        success,
        error,
        warning,
        info,
        undo,
        notification,
    }), [addToast, error, info, notification, removeToast, success, toasts, undo, warning]);

    return (
        <ToastContext.Provider value={value}>
            {children}
        </ToastContext.Provider>
    );
}

/**
 * Hook to use toast notifications
 * Usage: const toast = useToast(); toast.success("Saved!");
 */
export function useToast(): Omit<ToastContextType, 'toasts' | 'removeToast'> {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within ToastProvider');
    }
    return context;
}

/**
 * Internal hook to access toast state (for ToastContainer)
 */
function useToastState(): ToastContextType {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToastState must be used within ToastProvider');
    }
    return context;
}

/**
 * ToastContainer component - renders all active toasts
 * Should be placed once in the app (typically in layout)
 */
export function ToastContainer() {
    const { toasts, removeToast } = useToastState();

    const topToasts = toasts.filter(t => t.variant !== 'notification');
    const bottomToasts = toasts.filter(t => t.variant === 'notification');

    return (
        <>
            {/* Standard toasts — top of screen */}
            <div className="fixed top-4 left-4 right-4 sm:left-auto sm:right-4 z-[9998] flex flex-col gap-3 pointer-events-none sm:max-w-sm" style={{ top: 'max(1rem, env(safe-area-inset-top, 1rem))' }}>
                {topToasts.map(toast => (
                    <ToastItem
                        key={toast.id}
                        toast={toast}
                        onClose={() => removeToast(toast.id)}
                    />
                ))}
            </div>
            {/* Push notification toasts — bottom of screen, above bottom nav */}
            <div
                className="fixed left-4 right-4 sm:left-auto sm:right-4 z-[9998] flex flex-col-reverse gap-3 pointer-events-none sm:max-w-sm"
                style={{ bottom: 'var(--app-notification-surface-bottom, 1rem)' }}
            >
                {bottomToasts.map(toast => (
                    <ToastItem
                        key={toast.id}
                        toast={toast}
                        onClose={() => removeToast(toast.id)}
                    />
                ))}
            </div>
        </>
    );
}

/**
 * Individual toast notification
 */
function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
    const getStyles = (variant: ToastVariant) => {
        switch (variant) {
            case 'success':
                return {
                    bg: 'bg-green-50 border-green-200',
                    icon: 'bg-green-100 text-green-600',
                    title: 'text-green-900',
                    desc: 'text-green-700',
                    button: 'text-green-600 hover:text-green-700',
                };
            case 'error':
                return {
                    bg: 'bg-red-50 border-red-200',
                    icon: 'bg-red-100 text-red-600',
                    title: 'text-red-900',
                    desc: 'text-red-700',
                    button: 'text-red-600 hover:text-red-700',
                };
            case 'warning':
                return {
                    bg: 'bg-amber-50 border-amber-200',
                    icon: 'bg-amber-100 text-amber-600',
                    title: 'text-amber-900',
                    desc: 'text-amber-700',
                    button: 'text-amber-600 hover:text-amber-700',
                };
            case 'info':
            default:
                return {
                    bg: 'bg-blue-50 border-blue-200',
                    icon: 'bg-blue-100 text-blue-600',
                    title: 'text-blue-900',
                    desc: 'text-blue-700',
                    button: 'text-blue-600 hover:text-blue-700',
                };
            case 'notification':
                return {
                    bg: 'bg-[rgba(var(--paper-sage),0.12)] border-[rgba(var(--paper-sage),0.35)]',
                    icon: 'bg-[rgba(var(--paper-sage),0.2)] text-[rgb(var(--paper-sage))]',
                    title: 'text-[rgb(var(--text-primary))]',
                    desc: 'text-ink-secondary',
                    button: 'text-primary hover:text-primary/80',
                };
        }
    };

    const getIcon = (variant: ToastVariant) => {
        switch (variant) {
            case 'success':
                return (
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                        <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                        />
                    </svg>
                );
            case 'error':
                return (
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                        <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                            clipRule="evenodd"
                        />
                    </svg>
                );
            case 'warning':
                return (
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                        <path
                            fillRule="evenodd"
                            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                            clipRule="evenodd"
                        />
                    </svg>
                );
            case 'info':
            default:
                return (
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                        <path
                            fillRule="evenodd"
                            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                            clipRule="evenodd"
                        />
                    </svg>
                );
            case 'notification':
                return (
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
                    </svg>
                );
        }
    };

    const styles = getStyles(toast.variant);
    const slideDirection = toast.variant === 'notification'
        ? 'slide-in-from-bottom-4'
        : 'slide-in-from-top-2';

    return (
        <div
            className={`pointer-events-auto animate-in ${slideDirection} fade-in-0 duration-300 border rounded-lg p-4 shadow-lg ${styles.bg}`}
            role="alert"
        >
            <div className="flex gap-3">
                <div className={`flex-shrink-0 h-6 w-6 rounded-full flex items-center justify-center ${styles.icon}`}>
                    {getIcon(toast.variant)}
                </div>

                <div className="flex-1 min-w-0">
                    <h3 className={`font-semibold text-sm ${styles.title} truncate`}>{toast.title}</h3>
                    {toast.description && (
                        <p className={`text-sm mt-1 line-clamp-2 ${styles.desc}`}>{toast.description}</p>
                    )}
                </div>

                {toast.action && (
                    <button
                        onClick={() => {
                            toast.action?.onClick();
                            onClose();
                        }}
                        className={`flex-shrink-0 font-semibold text-sm hover:underline whitespace-nowrap ${styles.button}`}
                    >
                        {toast.action.label}
                    </button>
                )}

                <button
                    onClick={onClose}
                    className={`flex-shrink-0 h-5 w-5 flex items-center justify-center rounded hover:bg-white/20 transition-colors ${styles.button}`}
                    aria-label="Close notification"
                >
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                        <path
                            fillRule="evenodd"
                            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                            clipRule="evenodd"
                        />
                    </svg>
                </button>
            </div>
        </div>
    );
}
