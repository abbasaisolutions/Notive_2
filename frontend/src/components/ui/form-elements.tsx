import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion, HTMLMotionProps, AnimatePresence } from 'framer-motion';

function cn(...inputs: (string | undefined | null | false)[]) {
    return twMerge(clsx(inputs));
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
}

export function Input({ label, error, className, id, ...props }: InputProps) {
    return (
        <div className="w-full">
            {label && (
                <label htmlFor={id} className="block text-sm font-medium text-cream/80 mb-1.5">
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
                    className={cn(
                        'w-full px-4 py-3 rounded-xl bg-teal-dark/50 border border-cream/10',
                        'text-cream placeholder-cream/40',
                        'focus:outline-none focus:ring-2 focus:ring-secondary/50 focus:border-secondary/50',
                        'transition-all duration-200',
                        error && 'border-red-500/50 focus:ring-red-500/50',
                        className
                    )}
                    {...props}
                />
            </motion.div>
            <AnimatePresence>
                {error && (
                    <motion.p
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-1.5 text-sm text-red-400 overflow-hidden"
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
        'px-6 py-3 rounded-xl font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed';

    const variants = {
        primary:
            'bg-primary hover:bg-primary/90 text-cream shadow-lg shadow-primary/25 hover:shadow-primary/40',
        secondary:
            'bg-teal-light hover:bg-teal-light/80 text-cream border border-cream/10',
        ghost: 'bg-transparent hover:bg-cream/5 text-cream/80 hover:text-cream',
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
                <svg
                    className="animate-spin h-5 w-5"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                >
                    <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                    ></circle>
                    <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                </svg>
            )}
            {children}
        </motion.button>
    );
}
