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
                        'w-full px-4 py-3 rounded-xl bg-surface-1/70 border border-white/15',
                        'text-white placeholder-ink-muted',
                        'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50',
                        'transition-all duration-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]',
                        error && 'border-white/35 focus:ring-white/25',
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
                        className="mt-1.5 text-sm text-ink-secondary overflow-hidden"
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
            'bg-gradient-to-r from-primary to-primary/80 text-white border border-white/20 shadow-lg shadow-primary/30 hover:brightness-105',
        secondary:
            'bg-surface-2/80 text-white border border-white/15 hover:bg-surface-2',
        ghost: 'bg-transparent text-ink-secondary hover:text-white hover:bg-white/5',
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
