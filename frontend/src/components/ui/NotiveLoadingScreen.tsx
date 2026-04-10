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

const REVEAL_DURATION = 2.6;
const REVEAL_PAUSE = 1.0;

/**
 * The Notive feather-quill logo rendered as inline SVG.
 * A left-to-right clip reveal makes it look like a pen is drawing it.
 *
 * Structure (matches the app icon / notive-logo.jpg):
 *   - Sage-green upper vanes curving to the right
 *   - Coral / salmon lower vanes curving to the left
 *   - Dark central rachis (stem)
 *   - Fountain-pen nib at the bottom
 */
function FeatherLogo({ size }: { size: number }) {
    return (
        <svg
            viewBox="0 0 120 200"
            width={size}
            height={size * (200 / 120)}
            fill="none"
            aria-hidden="true"
        >
            <defs>
                <linearGradient id="fl-sage" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7E9D95" />
                    <stop offset="100%" stopColor="#8A9A6F" />
                </linearGradient>
                <linearGradient id="fl-coral" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#D8A896" />
                    <stop offset="100%" stopColor="#E7A896" />
                </linearGradient>
            </defs>

            {/* ── Upper sage-green vanes ── */}
            {/* Right vane 1 (top) */}
            <path d="M60 20 Q85 15 95 8 Q80 30 60 40Z" fill="url(#fl-sage)" opacity="0.85" />
            {/* Right vane 2 */}
            <path d="M60 38 Q88 30 100 22 Q82 48 60 56Z" fill="url(#fl-sage)" opacity="0.9" />
            {/* Right vane 3 */}
            <path d="M60 54 Q90 44 105 36 Q85 64 60 72Z" fill="url(#fl-sage)" opacity="0.95" />
            {/* Left vane 1 (top) */}
            <path d="M60 20 Q35 15 25 8 Q40 30 60 40Z" fill="url(#fl-sage)" opacity="0.75" />
            {/* Left vane 2 */}
            <path d="M60 38 Q32 30 20 22 Q38 48 60 56Z" fill="url(#fl-sage)" opacity="0.8" />

            {/* ── Lower coral vanes ── */}
            {/* Right vane 4 */}
            <path d="M60 70 Q92 58 108 50 Q88 80 60 88Z" fill="url(#fl-coral)" opacity="0.85" />
            {/* Right vane 5 */}
            <path d="M60 86 Q90 76 106 68 Q86 96 60 104Z" fill="url(#fl-coral)" opacity="0.9" />
            {/* Left vane 3 */}
            <path d="M60 70 Q28 58 12 50 Q32 80 60 88Z" fill="url(#fl-coral)" opacity="0.75" />
            {/* Left vane 4 */}
            <path d="M60 86 Q30 76 14 68 Q34 96 60 104Z" fill="url(#fl-coral)" opacity="0.8" />
            {/* Left vane 5 — small curling tip */}
            <path d="M60 102 Q34 94 18 86 Q38 110 60 116Z" fill="url(#fl-coral)" opacity="0.7" />

            {/* ── Central stem (rachis) ── */}
            <path
                d="M60 12 Q59 60 58 120 L58 148 Q59 152 60 154 Q61 152 62 148 L62 120 Q61 60 60 12Z"
                fill="#3D5B52"
                opacity="0.92"
            />

            {/* ── Fountain-pen nib ── */}
            <path
                d="M54 148 L60 172 L66 148 Q63 152 60 154 Q57 152 54 148Z"
                fill="#2A3D36"
            />
            {/* Nib slit */}
            <line x1="60" y1="154" x2="60" y2="168" stroke="#1A2A24" strokeWidth="0.8" />
            {/* Nib shoulder highlights */}
            <path d="M55 149 Q57 146 58 148" stroke="rgba(255,255,255,0.25)" strokeWidth="0.6" fill="none" />
            <path d="M65 149 Q63 146 62 148" stroke="rgba(255,255,255,0.25)" strokeWidth="0.6" fill="none" />

            {/* ── Ink dot at tip ── */}
            <circle cx="60" cy="172" r="1.8" fill="#8A9A6F" opacity="0.7" />
        </svg>
    );
}

/**
 * Wrapper that reveals the feather logo from top to bottom using a clip-path
 * animation, creating the illusion of the quill being drawn onto the page.
 */
function RevealingFeather({
    prefersReducedMotion,
    isInline,
}: {
    prefersReducedMotion: boolean | null;
    isInline: boolean;
}) {
    const size = isInline ? 52 : 64;

    if (prefersReducedMotion) {
        return (
            <div className="flex items-center justify-center">
                <FeatherLogo size={size} />
            </div>
        );
    }

    return (
        <div className="flex items-center justify-center">
            <motion.div
                style={{ clipPath: 'inset(0 0 100% 0)' }}
                animate={{ clipPath: ['inset(0 0 100% 0)', 'inset(0 0 0% 0)'] }}
                transition={{
                    duration: REVEAL_DURATION,
                    ease: [0.22, 0.61, 0.36, 1],
                    repeat: Infinity,
                    repeatDelay: REVEAL_PAUSE,
                }}
            >
                <FeatherLogo size={size} />
            </motion.div>
        </div>
    );
}

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
                        <RevealingFeather prefersReducedMotion={prefersReducedMotion} isInline={isInline} />

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
