'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { cn } from '@/utils/cn';

const DEFAULT_PHRASES = [
    'Pulling your notes together...',
    'Listening to your patterns...',
    'Tracing threads of thought...',
    'Gathering your story so far...',
    'Finding what matters most...',
];

const WRITING_DURATION = 2.8;
const WRITING_DELAY = 0.7;
const WRITING_PATH = 'M29 60C32 48 38 48 41 60C43 68 47 68 50 59C53 50 59 50 63 60C66 68 71 68 75 57C79 46 84 46 88 58C91 67 96 67 99 58C101 52 103 43 105 34C106 29 108 29 109 34C111 43 109 53 108 59C106 67 111 68 116 58C119 52 121 52 123 55';
const LOADER_PEN_ASSET = '/images/Submark%20%20Icon-Only.jpg';

interface NotiveLoadingScreenProps {
    phrases?: string[];
    phraseInterval?: number;
    variant?: 'fullscreen' | 'inline';
    className?: string;
}

export default function NotiveLoadingScreen({
    phrases = DEFAULT_PHRASES,
    phraseInterval = 2800,
    variant = 'fullscreen',
    className,
}: NotiveLoadingScreenProps) {
    const [phraseIndex, setPhraseIndex] = useState(0);
    const prefersReducedMotion = useReducedMotion();
    const isInline = variant === 'inline';

    useEffect(() => {
        if (prefersReducedMotion || phrases.length <= 1) return;
        const interval = setInterval(() => {
            setPhraseIndex((prev) => (prev + 1) % phrases.length);
        }, phraseInterval);
        return () => clearInterval(interval);
    }, [phrases.length, phraseInterval, prefersReducedMotion]);

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

                                <motion.path
                                    d={WRITING_PATH}
                                    stroke="rgba(150,118,102,0.18)"
                                    strokeWidth="3.6"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    initial={prefersReducedMotion ? { opacity: 0.65 } : { opacity: 0.3 }}
                                    animate={prefersReducedMotion ? { opacity: 0.65 } : { opacity: [0.18, 0.28, 0.18] }}
                                    transition={prefersReducedMotion
                                        ? { duration: 0 }
                                        : { duration: WRITING_DURATION + WRITING_DELAY, repeat: Infinity, ease: 'easeInOut' }}
                                />

                                <motion.path
                                    d={WRITING_PATH}
                                    stroke="rgba(122,87,76,0.94)"
                                    strokeWidth="2.6"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    initial={prefersReducedMotion ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0.95 }}
                                    animate={prefersReducedMotion ? { pathLength: 1, opacity: 1 } : { pathLength: [0, 1] }}
                                    transition={prefersReducedMotion
                                        ? { duration: 0 }
                                        : { duration: WRITING_DURATION, repeat: Infinity, repeatDelay: WRITING_DELAY, ease: 'easeInOut' }}
                                />

                                <motion.g
                                    initial={prefersReducedMotion ? { x: 123, y: 55, rotate: -12 } : { x: 29, y: 60, rotate: -18 }}
                                    animate={prefersReducedMotion
                                        ? { x: 123, y: 55, rotate: -12 }
                                        : {
                                            x: [29, 37, 37, 50, 50, 63, 63, 75, 75, 88, 95, 101, 101, 108, 108, 123],
                                            y: [60, 49, 49, 59, 59, 50, 50, 57, 57, 49, 42, 33, 33, 59, 59, 55],
                                            rotate: [-18, -12, -16, -11, -15, -10, -14, -11, -15, -12, -9, -8, -12, -14, -12, -11],
                                        }}
                                    transition={prefersReducedMotion
                                        ? { duration: 0 }
                                        : {
                                            duration: WRITING_DURATION,
                                            repeat: Infinity,
                                            repeatDelay: WRITING_DELAY,
                                            ease: 'easeInOut',
                                            times: [0, 0.08, 0.12, 0.22, 0.26, 0.38, 0.42, 0.56, 0.6, 0.74, 0.8, 0.84, 0.88, 0.94, 0.97, 1],
                                        }}
                                >
                                    <image
                                        href={LOADER_PEN_ASSET}
                                        x="-35"
                                        y="-118"
                                        width="72"
                                        height="124"
                                        preserveAspectRatio="xMidYMid meet"
                                        opacity="0.96"
                                        filter="url(#notiveLoaderPenKey)"
                                        style={{ mixBlendMode: 'multiply' }}
                                    />
                                </motion.g>

                                <motion.circle
                                    cx="123"
                                    cy="55"
                                    r="1.4"
                                    fill="rgba(122,87,76,0.52)"
                                    initial={prefersReducedMotion ? { opacity: 0.45 } : { opacity: 0 }}
                                    animate={prefersReducedMotion ? { opacity: 0.45 } : { opacity: [0, 0, 0.45, 0] }}
                                    transition={prefersReducedMotion
                                        ? { duration: 0 }
                                        : { duration: WRITING_DURATION + WRITING_DELAY, repeat: Infinity, ease: 'easeInOut', times: [0, 0.86, 0.95, 1] }}
                                />
                            </motion.svg>
                        </div>

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
