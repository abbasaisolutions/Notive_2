'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

const DEFAULT_PHRASES = [
    'Pulling your notes together\u2026',
    'Listening to your patterns\u2026',
    'Tracing threads of thought\u2026',
    'Gathering your story so far\u2026',
    'Finding what matters most\u2026',
];

interface NotiveLoadingScreenProps {
    phrases?: string[];
    phraseInterval?: number;
}

export default function NotiveLoadingScreen({
    phrases = DEFAULT_PHRASES,
    phraseInterval = 2800,
}: NotiveLoadingScreenProps) {
    const [phraseIndex, setPhraseIndex] = useState(0);
    const prefersReducedMotion = useReducedMotion();

    useEffect(() => {
        if (prefersReducedMotion) return;
        const interval = setInterval(() => {
            setPhraseIndex((prev) => (prev + 1) % phrases.length);
        }, phraseInterval);
        return () => clearInterval(interval);
    }, [phrases.length, phraseInterval, prefersReducedMotion]);

    return (
        <div className="flex min-h-screen items-center justify-center pb-6 md:pb-20">
            <div className="flex flex-col items-center gap-6 px-6">
                {/* Animated quill writing */}
                <motion.svg
                    viewBox="0 0 80 80"
                    fill="none"
                    aria-hidden="true"
                    className="h-20 w-20 text-[rgba(141,123,105,0.96)]"
                    animate={prefersReducedMotion ? undefined : { rotate: [0, -3, 3, -2, 0] }}
                    transition={prefersReducedMotion ? undefined : { duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
                >
                    {/* Feather shaft */}
                    <motion.path
                        d="M18 64L56 14"
                        stroke="currentColor"
                        strokeWidth="2.8"
                        strokeLinecap="round"
                        initial={prefersReducedMotion ? { pathLength: 1 } : { pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={prefersReducedMotion ? { duration: 0 } : { duration: 1.4, ease: 'easeOut' }}
                    />
                    {/* Right barbs */}
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
                    {/* Left barbs */}
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
                    {/* Nib tip */}
                    <motion.path
                        d="M18 64L14 68"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        initial={prefersReducedMotion ? { pathLength: 1 } : { pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.5, delay: 1.2, ease: 'easeOut' }}
                    />
                    {/* Ink drop pulse */}
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

                {/* Writing line shimmer */}
                <div className="flex items-center gap-2">
                    {[0, 1, 2].map((i) => (
                        <motion.span
                            key={i}
                            className="block h-[2px] rounded-full bg-[rgba(138,154,111,0.5)]"
                            initial={prefersReducedMotion ? { width: 14 + i * 8 } : { width: 0 }}
                            animate={prefersReducedMotion ? { width: 14 + i * 8 } : { width: [0, 20 + i * 12, 14 + i * 8] }}
                            transition={prefersReducedMotion
                                ? { duration: 0 }
                                : {
                                    duration: 1.6,
                                    delay: 1.6 + i * 0.3,
                                    repeat: Infinity,
                                    repeatType: 'reverse',
                                    repeatDelay: 1.4,
                                    ease: 'easeInOut',
                                }}
                        />
                    ))}
                </div>

                {/* Rotating phrases */}
                <div className="relative h-12 w-64 overflow-hidden sm:w-72">
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
    );
}
