'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { cn } from '@/utils/cn';
import { isNativePlatform } from '@/utils/platform';

const DEFAULT_PHRASES = [
    'Pulling your notes together...',
    'Listening to your patterns...',
    'Tracing threads of thought...',
    'Gathering your story so far...',
    'Finding what matters most...',
];

const WRITING_DURATION = 2.8;
const WRITING_DELAY = 0.7;
// SVG path for the word "Notive" in a handwriting/cursive style
// Hand-traced calligraphic letters with proper proportions for writing animation
const WRITING_PATH = `
M35 50 Q40 35 45 50 Q50 65 55 50 Q60 40 65 50 L70 65
M75 35 L75 65 Q75 70 80 70 L85 70 Q90 70 90 65 L90 50
M100 65 L100 50 Q100 40 105 40 Q110 40 110 50 L110 65
M120 50 Q120 40 125 40 Q132 40 132 50 Q132 65 120 65 Q132 65 132 50
M145 50 L150 65 L155 50
M160 65 L160 50 Q160 40 165 40 Q170 40 170 50 L170 65`;

interface NotiveLoadingScreenProps {
    phrases?: string[];
    phraseInterval?: number;
    variant?: 'fullscreen' | 'inline';
    className?: string;
}

function SafeLoaderArt({
    prefersReducedMotion,
    isInline,
}: {
    prefersReducedMotion: boolean | null;
    isInline: boolean;
}) {
    return (
        <motion.svg
            viewBox="0 0 80 80"
            fill="none"
            aria-hidden="true"
            className={cn('text-[rgba(141,123,105,0.96)]', isInline ? 'mx-auto h-16 w-16' : 'h-20 w-20')}
            animate={prefersReducedMotion ? undefined : { rotate: [0, -3, 3, -2, 0] }}
            transition={prefersReducedMotion ? undefined : { duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
        >
            <motion.path
                d="M18 64L56 14"
                stroke="currentColor"
                strokeWidth="2.8"
                strokeLinecap="round"
                initial={prefersReducedMotion ? { pathLength: 1 } : { pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={prefersReducedMotion ? { duration: 0 } : { duration: 1.4, ease: 'easeOut' }}
            />
            <motion.path
                d="M56 14C46 20 42 30 40 38"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                initial={prefersReducedMotion ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={prefersReducedMotion ? { duration: 0 } : { duration: 1, delay: 0.5, ease: 'easeOut' }}
            />
            <motion.path
                d="M50 20C42 26 38 34 36 42"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                initial={prefersReducedMotion ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.9, delay: 0.7, ease: 'easeOut' }}
            />
            <motion.path
                d="M44 28C38 32 34 38 32 46"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                initial={prefersReducedMotion ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.8, delay: 0.9, ease: 'easeOut' }}
            />
            <motion.path
                d="M56 14C52 24 44 30 36 34"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                initial={prefersReducedMotion ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={prefersReducedMotion ? { duration: 0 } : { duration: 1, delay: 0.6, ease: 'easeOut' }}
            />
            <motion.path
                d="M48 24C44 32 38 36 30 40"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                initial={prefersReducedMotion ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.8, delay: 0.8, ease: 'easeOut' }}
            />
            <motion.path
                d="M18 64L14 68"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                initial={prefersReducedMotion ? { pathLength: 1 } : { pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.5, delay: 1.2, ease: 'easeOut' }}
            />
            <motion.circle
                cx="13"
                cy="69"
                r="1.5"
                fill="rgba(138,154,111,0.85)"
                initial={prefersReducedMotion ? { scale: 1, opacity: 0.7 } : { scale: 0, opacity: 0 }}
                animate={prefersReducedMotion ? { scale: 1, opacity: 0.7 } : { scale: [0, 1.4, 1], opacity: [0, 1, 0.7] }}
                transition={prefersReducedMotion ? { duration: 0 } : { duration: 1.2, delay: 1.5, repeat: Infinity, repeatDelay: 2 }}
            />
        </motion.svg>
    );
}

function EnhancedLoaderArt({
    prefersReducedMotion,
    isInline,
}: {
    prefersReducedMotion: boolean | null;
    isInline: boolean;
}) {
    return (
        <div className={cn(
            'w-full overflow-hidden rounded-[1.5rem] border border-[rgba(92,92,92,0.1)] bg-[rgba(248,244,237,0.72)]',
            isInline ? 'px-3 py-3.5 sm:px-4' : 'px-4 py-4.5 sm:px-5',
        )}>
            <motion.svg
                viewBox="0 0 140 96"
                fill="none"
                aria-hidden="true"
                className={cn('w-full text-[rgb(126,117,103)]', isInline ? 'h-[6.5rem]' : 'h-32')}
            >
                <defs>
                    <linearGradient id="notiveLoaderFeatherFill" x1="8" y1="0" x2="66" y2="-94" gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stopColor="rgba(231,168,150,0.98)" />
                        <stop offset="38%" stopColor="rgba(181,204,193,0.96)" />
                        <stop offset="100%" stopColor="rgba(126,157,149,0.98)" />
                    </linearGradient>
                    <linearGradient id="notiveLoaderPlumeFill" x1="-10" y1="-18" x2="20" y2="-58" gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stopColor="rgba(226,160,145,0.94)" />
                        <stop offset="100%" stopColor="rgba(210,142,129,0.84)" />
                    </linearGradient>
                    <linearGradient id="notiveLoaderStemFill" x1="2" y1="6" x2="52" y2="-92" gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stopColor="rgba(45,71,63,0.98)" />
                        <stop offset="100%" stopColor="rgba(93,123,113,0.98)" />
                    </linearGradient>
                    <filter id="notiveLoaderPenKey" x="-25%" y="-25%" width="150%" height="150%" colorInterpolationFilters="sRGB">
                        <feColorMatrix
                            in="SourceGraphic"
                            type="matrix"
                            values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 -1 -1 -1 0 2.78"
                            result="alphaKeyed"
                        />
                        <feComponentTransfer in="alphaKeyed" result="penCut">
                            <feFuncA type="gamma" amplitude="1.18" exponent="1.65" offset="-0.08" />
                        </feComponentTransfer>
                        <feComposite in="SourceGraphic" in2="penCut" operator="in" />
                    </filter>
                </defs>

                <path d="M22 18V86" stroke="rgba(214,180,137,0.4)" strokeWidth="1.6" />
                <path d="M28 28H124" stroke="rgba(92,92,92,0.14)" strokeWidth="1.4" strokeLinecap="round" />
                <path d="M28 56H124" stroke="rgba(138,154,111,0.22)" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M28 84H124" stroke="rgba(92,92,92,0.14)" strokeWidth="1.4" strokeLinecap="round" />

                {/* Animate the word 'Notive' being written by hand */}
                <motion.path
                    d={WRITING_PATH}
                    stroke="rgba(138,154,111,0.85)"
                    strokeWidth="2.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                    initial={prefersReducedMotion ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0.95 }}
                    animate={prefersReducedMotion ? { pathLength: 1, opacity: 1 } : { pathLength: [0, 1] }}
                    transition={prefersReducedMotion
                        ? { duration: 0 }
                        : { duration: WRITING_DURATION, repeat: Infinity, repeatDelay: WRITING_DELAY, ease: 'easeInOut' }}
                />

                {/* Feather pen following the text */}
                <motion.g
                    initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0 }}
                    animate={prefersReducedMotion ? { opacity: 0 } : { opacity: [1, 1, 0] }}
                    transition={prefersReducedMotion
                        ? { duration: 0 }
                        : { duration: WRITING_DURATION, repeat: Infinity, repeatDelay: WRITING_DELAY, ease: 'easeInOut' }}
                >
                    {/* Feather quill shape */}
                    <motion.path
                        d="M170 40 Q172 42 174 45 L168 50 Q166 48 164 45 Z"
                        fill="rgba(231,168,150,0.85)"
                        stroke="rgba(181,104,93,0.7)"
                        strokeWidth="0.8"
                    />
                    {/* Feather detail */}
                    <motion.path
                        d="M172 42 Q173 43 174 44"
                        stroke="rgba(138,154,111,0.6)"
                        strokeWidth="0.6"
                    />
                </motion.g>
            </motion.svg>
        </div>
    );
}

export default function NotiveLoadingScreen({
    phrases = DEFAULT_PHRASES,
    phraseInterval = 2800,
    variant = 'fullscreen',
    className,
}: NotiveLoadingScreenProps) {
    const [phraseIndex, setPhraseIndex] = useState(0);
    const [useEnhancedLoader, setUseEnhancedLoader] = useState(false);
    const prefersReducedMotion = useReducedMotion();
    const isInline = variant === 'inline';

    useEffect(() => {
        if (prefersReducedMotion || phrases.length <= 1) return;
        const interval = setInterval(() => {
            setPhraseIndex((prev) => (prev + 1) % phrases.length);
        }, phraseInterval);
        return () => clearInterval(interval);
    }, [phrases.length, phraseInterval, prefersReducedMotion]);

    useEffect(() => {
        const isAndroidBrowser = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);

        // Default to the lighter SVG loader, then opt into the richer version
        // only when we know we're not in Android or a native WebView shell.
        setUseEnhancedLoader(!isAndroidBrowser && !isNativePlatform());
    }, []);

    return (
        <div
            className={cn(
                isInline
                    ? 'w-full'
                    : 'flex min-h-screen items-center justify-center pb-6 md:pb-20',
                className,
            )}
        >
            <div className={cn('mx-auto w-full', isInline ? 'max-w-3xl' : 'max-w-md px-6')}>
                <div className={cn(
                    'rounded-[1.9rem] border border-[rgba(92,92,92,0.14)] bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(255,251,245,0.9))] shadow-[0_8px_24px_rgba(92,92,92,0.06)]',
                    isInline ? 'px-4 py-4 sm:px-5 sm:py-5' : 'px-6 py-6 sm:px-7 sm:py-7',
                )}>
                    <div className={cn('flex flex-col items-center', isInline ? 'gap-4' : 'gap-6')}>
                        {useEnhancedLoader ? (
                            <EnhancedLoaderArt prefersReducedMotion={prefersReducedMotion} isInline={isInline} />
                        ) : (
                            <SafeLoaderArt prefersReducedMotion={prefersReducedMotion} isInline={isInline} />
                        )}

                        <div className="text-center">
                            <p className="text-[0.64rem] font-semibold uppercase tracking-[0.18em] text-[rgb(126,117,103)]">
                                Loading your notebook
                            </p>

                            <div className={cn('relative mt-2 overflow-hidden', isInline ? 'h-10 w-full' : 'h-12 w-64 sm:w-72')}>
                                {prefersReducedMotion ? (
                                    <p className="absolute inset-0 text-center text-[0.82rem] font-medium leading-6 text-[rgb(107,107,107)]">
                                        {phrases[phraseIndex]}
                                    </p>
                                ) : (
                                    <AnimatePresence mode="wait">
                                        <motion.p
                                            key={phraseIndex}
                                            className="absolute inset-0 text-center text-[0.82rem] font-medium leading-6 text-[rgb(107,107,107)]"
                                            initial={{ opacity: 0, y: 12 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -12 }}
                                            transition={{ duration: 0.45, ease: 'easeInOut' }}
                                        >
                                            {phrases[phraseIndex]}
                                        </motion.p>
                                    </AnimatePresence>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
