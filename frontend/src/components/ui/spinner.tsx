import React from 'react';

type SpinnerSize = 'sm' | 'md' | 'lg';
type SpinnerVariant = 'primary' | 'accent' | 'white';

interface SpinnerProps {
    size?: SpinnerSize;
    variant?: SpinnerVariant;
    className?: string;
}

/**
 * Standardized loading spinner component
 */
export function Spinner({
    size = 'md',
    variant = 'primary',
    className = '',
}: SpinnerProps) {
    const sizeClasses = {
        sm: 'h-4 w-4',
        md: 'h-6 w-6',
        lg: 'h-8 w-8',
    };

    const variantClasses = {
        primary: 'text-primary',
        accent: 'text-sage-500',
        white: 'text-white',
    };

    const borderClasses = {
        sm: 'border-2',
        md: 'border-2',
        lg: 'border-3',
    };

    return (
        <svg
            className={`
        animate-spin rounded-full
        ${sizeClasses[size]}
        ${borderClasses[size]}
        border-current
        border-t-transparent
        ${variantClasses[variant]}
        ${className}
      `}
            fill="none"
            viewBox="0 0 24 24"
            role="status"
            aria-label="Loading"
        >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
        </svg>
    );
}

interface LoadingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    loading?: boolean;
    children: React.ReactNode;
}

/**
 * Button that shows loading spinner when disabled
 */
export function LoadingButton({ loading = false, children, disabled, className = '', ...props }: LoadingButtonProps) {
    return (
        <button
            disabled={loading || disabled}
            className={`
        flex items-center justify-center gap-2
        px-4 py-2 rounded-lg font-medium
        transition-all duration-200
        disabled:opacity-60 disabled:cursor-not-allowed
        ${className}
      `}
            {...props}
        >
            {loading && <Spinner size="sm" variant="white" />}
            <span className={loading ? 'text-transparent' : ''}>{children}</span>
        </button>
    );
}
