'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { cn } from '@/utils/cn';
import useHasMounted from '@/hooks/use-has-mounted';

const DEFAULT_PHRASES = [
    'Pulling your notes together...',
    'Listening to your patterns...',
    'Tracing threads of thought...',
    'Gathering your story so far...',
    'Finding what matters most...',
];

const REVEAL_DURATION = 2.6;
const REVEAL_PAUSE = 1.0;
const LOADING_STEPS = ['Open', 'Gather', 'Focus'];

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
 * Includes subtle breathing glow effect for visual polish.
 */
function RevealingFeather({
    prefersReducedMotion,
    isInline,
}: {
    prefersReducedMotion: boolean | null;
    isInline: boolean;
}) {
    const size = isInline ? 50 : 62;
    const sheetClassName = cn(
        'absolute bottom-0 rounded-[1.45rem] border border-[rgba(var(--paper-border),0.16)] bg-[linear-gradient(180deg,rgba(255,255,255,0.84),rgba(255,251,245,0.92))] shadow-[0_16px_32px_rgba(92,92,92,0.08)]',
        isInline ? 'h-20 w-40' : 'h-24 w-48',
    );
    const stageClassName = cn(
        'relative mx-auto flex items-center justify-center',
        isInline ? 'h-32 w-44' : 'h-40 w-56',
    );

    if (prefersReducedMotion) {
        return (
            <div className={stageClassName}>
                <div className={sheetClassName}>
                    <div className="absolute inset-x-5 top-6 space-y-3">
                        <div className="h-px rounded-full bg-[rgba(92,92,92,0.16)]" />
                        <div className="h-px rounded-full bg-[rgba(92,92,92,0.13)]" />
                        <div className="h-px w-2/3 rounded-full bg-[rgba(92,92,92,0.11)]" />
                    </div>
                </div>
                <div className="relative z-10 -translate-y-4">
                    <FeatherLogo size={size} />
                </div>
            </div>
        );
    }

    return (
        <div className={stageClassName}>
            <motion.div
                className={sheetClassName}
                animate={{
                    y: [2, -2, 2],
                    rotate: [-0.6, 0.4, -0.6],
                }}
                transition={{
                    duration: 5.2,
                    ease: 'easeInOut',
                    repeat: Infinity,
                }}
            >
                <div className="absolute inset-x-5 top-6 space-y-3">
                    {[0, 1, 2].map((line) => (
                        <motion.div
                            key={line}
                            className={cn(
                                'h-px origin-left rounded-full bg-[rgba(92,92,92,0.15)]',
                                line === 2 ? 'w-2/3' : 'w-full',
                            )}
                            animate={{ scaleX: [0.64, 1, 0.72] }}
                            transition={{
                                duration: 2.8,
                                ease: 'easeInOut',
                                repeat: Infinity,
                                delay: line * 0.28,
                            }}
                        />
                    ))}
                </div>
                <motion.div
                    className="absolute bottom-6 left-5 h-1 rounded-full bg-[linear-gradient(90deg,rgba(138,154,111,0.08),rgba(138,154,111,0.78),rgba(216,168,150,0.54))]"
                    style={{ width: isInline ? 118 : 146, transformOrigin: 'left' }}
                    animate={{ scaleX: [0, 0.78, 1, 0] }}
                    transition={{
                        duration: 3.4,
                        ease: [0.22, 0.61, 0.36, 1],
                        repeat: Infinity,
                        repeatDelay: 0.35,
                    }}
                />
                <motion.span
                    className="absolute bottom-[1.15rem] left-5 h-4 w-4 rounded-[0.35rem] bg-[rgb(61,91,82)] shadow-[0_4px_12px_rgba(61,91,82,0.22)]"
                    style={{ rotate: 45 }}
                    animate={{
                        x: [0, isInline ? 104 : 130, isInline ? 118 : 146, 0],
                        opacity: [0, 1, 0.85, 0],
                    }}
                    transition={{
                        duration: 3.4,
                        ease: [0.22, 0.61, 0.36, 1],
                        repeat: Infinity,
                        repeatDelay: 0.35,
                    }}
                />
            </motion.div>

            <motion.div
                className="absolute rounded-full"
                style={{
                    width: isInline ? 108 : 132,
                    height: isInline ? 108 : 132,
                    background: 'radial-gradient(circle, rgba(126,157,149,0.18) 0%, transparent 70%)',
                    filter: 'blur(14px)',
                }}
                animate={{
                    scale: [0.95, 1.15, 0.95],
                    opacity: [0.35, 0.72, 0.35],
                }}
                transition={{
                    duration: 3.6,
                    ease: 'easeInOut',
                    repeat: Infinity,
                }}
            />

            <motion.div
                className="relative z-10 -translate-y-5 drop-shadow-[0_12px_20px_rgba(61,91,82,0.12)]"
                style={{ clipPath: 'inset(0 0 100% 0)' }}
                animate={{
                    clipPath: ['inset(0 0 100% 0)', 'inset(0 0 0% 0)'],
                    scale: [0.92, 1],
                    opacity: [0.8, 1],
                }}
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

function LoadingStepRail({
    activeStep,
    prefersReducedMotion,
}: {
    activeStep: number;
    prefersReducedMotion: boolean | null;
}) {
    return (
        <div className="mt-5 flex items-center justify-center gap-2" aria-hidden="true">
            {LOADING_STEPS.map((step, index) => {
                const isActive = index === activeStep;
                return (
                    <div
                        key={step}
                        className={cn(
                            'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.68rem] font-semibold',
                            isActive
                                ? 'border-[rgba(138,154,111,0.34)] bg-[rgba(138,154,111,0.12)] text-[rgb(71,91,74)]'
                                : 'border-[rgba(92,92,92,0.12)] bg-white/45 text-[rgb(126,117,103)]',
                        )}
                    >
                        <span className="relative flex h-1.5 w-1.5">
                            {isActive && !prefersReducedMotion && (
                                <motion.span
                                    className="absolute inline-flex h-full w-full rounded-full bg-[rgb(138,154,111)] opacity-50"
                                    animate={{ scale: [1, 2.2], opacity: [0.45, 0] }}
                                    transition={{ duration: 1.5, ease: 'easeOut', repeat: Infinity }}
                                />
                            )}
                            <span
                                className={cn(
                                    'relative inline-flex h-1.5 w-1.5 rounded-full',
                                    isActive ? 'bg-[rgb(138,154,111)]' : 'bg-[rgba(126,117,103,0.38)]',
                                )}
                            />
                        </span>
                        {step}
                    </div>
                );
            })}
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
    const hasMounted = useHasMounted();
    const reducedMotionPreference = useReducedMotion();
    const prefersReducedMotion = hasMounted && !!reducedMotionPreference;
    const isInline = variant === 'inline';
    const activeStep = phraseIndex % LOADING_STEPS.length;

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
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                    className={cn(
                        'app-paper-soft relative overflow-hidden rounded-[2rem] border border-[rgba(92,92,92,0.16)] shadow-[0_18px_44px_rgba(92,92,92,0.08)]',
                        isInline ? 'px-4 py-4 sm:px-5 sm:py-5' : 'px-6 py-8 sm:px-7 sm:py-9',
                    )}>
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.62),transparent_44%)]" />
                    {!prefersReducedMotion && (
                        <motion.div
                            className="pointer-events-none absolute inset-x-8 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(138,154,111,0.46),rgba(216,168,150,0.36),transparent)]"
                            animate={{ opacity: [0.2, 1, 0.2], x: [-24, 24, -24] }}
                            transition={{ duration: 4.2, ease: 'easeInOut', repeat: Infinity }}
                        />
                    )}

                    <div className={cn('relative z-10 flex flex-col items-center', isInline ? 'gap-3' : 'gap-6')}>
                        <RevealingFeather prefersReducedMotion={prefersReducedMotion} isInline={isInline} />

                        <div className="text-center">
                            <motion.p
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ duration: 0.6, delay: 0.2 }}
                                className="text-xs font-semibold uppercase text-[rgb(126,117,103)] [letter-spacing:0]"
                            >
                                Opening your notebook
                            </motion.p>

                            <div className={cn('relative mt-3 overflow-hidden', isInline ? 'h-10 w-full' : 'h-12 w-64 sm:w-72')}>
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
                            <LoadingStepRail activeStep={activeStep} prefersReducedMotion={prefersReducedMotion} />
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
