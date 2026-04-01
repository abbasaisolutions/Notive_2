import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion, HTMLMotionProps, AnimatePresence } from 'framer-motion';
import { FiLoader } from 'react-icons/fi';

function cn(...inputs: (string | undefined | null | false)[]) {
    return twMerge(clsx(inputs));
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
}

export function Input({ label, error, className, id, ...props }: InputProps) {
    const errorId = id ? `${id}-error` : undefined;

    return (
        <div className="w-full">
            {label && (
                <label htmlFor={id} className="block text-sm font-medium text-ink-secondary mb-1.5">
                    {label}
                </label>
            )}
            <motion.div
                initial={false}
                animate={error ? { x: [-10, 10, -5, 5, 0] } : {}}
                transition={{ duration: 0.4, type: 'spring' }}
            >
                <input
                    id={id}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error && errorId ? errorId : props['aria-describedby']}
                    className={cn(
                        'workspace-input w-full px-4 py-3 rounded-xl',
                        'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50',
                        'transition-all duration-200',
                        error && 'border-red-400/50 focus:ring-red-400/30',
                        className
                    )}
                    {...props}
                />
            </motion.div>
            <AnimatePresence>
                {error && (
                    <motion.p
                        id={errorId}
                        role="alert"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-1.5 text-sm text-red-600/90 overflow-hidden"
                    >
                        {error}
                    </motion.p>
                )}
            </AnimatePresence>
        </div>
    );
}

interface ButtonProps extends Omit<HTMLMotionProps<"button">, "children"> {
    variant?: 'primary' | 'secondary' | 'ghost';
    isLoading?: boolean;
    children: React.ReactNode;
}

export function Button({
    children,
    variant = 'primary',
    isLoading,
    className,
    disabled,
    ...props
}: ButtonProps) {
    const baseStyles =
        'px-6 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200';

    const variants = {
        primary:
            'workspace-button-primary hover:brightness-105',
        secondary:
            'workspace-button-secondary hover:brightness-[1.02]',
        ghost: 'workspace-button-ghost bg-transparent',
    };

    return (
        <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={cn(baseStyles, variants[variant], className)}
            disabled={disabled || isLoading}
            {...props}
        >
            {isLoading && (
                <FiLoader className="animate-spin h-5 w-5" aria-hidden="true" />
            )}
            {children}
        </motion.button>
    );
}
