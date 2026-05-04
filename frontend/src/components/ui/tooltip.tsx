'use client';

import React, { useId, useState } from 'react';
import { cn } from '@/utils/cn';

type TooltipSide = 'top' | 'bottom';
type TooltipAlign = 'start' | 'center' | 'end';

const sideClasses: Record<TooltipSide, string> = {
    top: 'bottom-full mb-2',
    bottom: 'top-full mt-2',
};

const alignClasses: Record<TooltipAlign, string> = {
    start: 'left-0',
    center: 'left-1/2 -translate-x-1/2',
    end: 'right-0',
};

type TooltipHintProps = React.HTMLAttributes<HTMLSpanElement> & {
    children: React.ReactNode;
    content: React.ReactNode;
    screenReaderLabel?: string;
    side?: TooltipSide;
    align?: TooltipAlign;
    tooltipClassName?: string;
};

export function TooltipHint({
    children,
    content,
    screenReaderLabel,
    side = 'top',
    align = 'center',
    className,
    tooltipClassName,
    onBlur,
    onClick,
    onKeyDown,
    ...props
}: TooltipHintProps) {
    const id = useId();
    const [isOpen, setIsOpen] = useState(false);
    const description = screenReaderLabel || (typeof content === 'string' ? content : undefined);
    const descriptionId = description ? `${id}-description` : undefined;
    const hasContent = Boolean(content);

    return (
        <span
            className={cn('group/tooltip relative inline-flex items-center', hasContent && 'touch-manipulation', className)}
            aria-describedby={descriptionId}
            aria-expanded={hasContent ? isOpen : undefined}
            role={hasContent ? 'button' : props.role}
            tabIndex={hasContent ? props.tabIndex ?? 0 : props.tabIndex}
            onBlur={(event) => {
                setIsOpen(false);
                onBlur?.(event);
            }}
            onClick={(event) => {
                if (hasContent) {
                    event.preventDefault();
                    event.stopPropagation();
                    setIsOpen((current) => !current);
                }
                onClick?.(event);
            }}
            onKeyDown={(event) => {
                if (hasContent && (event.key === 'Enter' || event.key === ' ')) {
                    event.preventDefault();
                    event.stopPropagation();
                    setIsOpen((current) => !current);
                }
                if (hasContent && event.key === 'Escape') {
                    event.preventDefault();
                    setIsOpen(false);
                }
                onKeyDown?.(event);
            }}
            {...props}
        >
            {children}
            {description && (
                <span id={descriptionId} className="sr-only">
                    {description}
                </span>
            )}
            <span
                role="tooltip"
                aria-hidden="true"
                className={cn(
                    'pointer-events-none absolute z-50 w-max max-w-[min(15rem,calc(100vw-2rem))] whitespace-normal break-words rounded-md border border-[rgba(var(--paper-border),0.55)] bg-surface-2 px-2.5 py-1.5 text-[0.68rem] font-medium leading-snug text-ink-secondary shadow-lg shadow-black/15 opacity-0 scale-95 transition duration-150 group-hover/tooltip:opacity-100 group-hover/tooltip:scale-100 group-active/tooltip:opacity-100 group-active/tooltip:scale-100 group-focus-within/tooltip:opacity-100 group-focus-within/tooltip:scale-100',
                    isOpen && 'opacity-100 scale-100',
                    sideClasses[side],
                    alignClasses[align],
                    tooltipClassName,
                )}
            >
                {content}
            </span>
        </span>
    );
}
