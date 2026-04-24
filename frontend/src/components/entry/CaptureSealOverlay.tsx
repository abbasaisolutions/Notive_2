'use client';

import { useEffect } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { audioFeedback } from '@/services/audio-feedback.service';

type CaptureSealOverlayProps = {
    show: boolean;
    label?: string;
};

export default function CaptureSealOverlay({ show, label = 'Sealed' }: CaptureSealOverlayProps) {
    const reducedMotion = useReducedMotion();

    useEffect(() => {
        if (show) audioFeedback.seal();
    }, [show]);

    return (
        <AnimatePresence>
            {show && (
                <motion.div
                    key="capture-seal"
                    role="status"
                    aria-live="polite"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="pointer-events-none fixed inset-0 z-[96] flex items-center justify-center bg-[rgba(248,244,237,0.72)] backdrop-blur-sm"
                >
                    <motion.div
                        initial={{ scale: reducedMotion ? 1 : 0.6, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.32, ease: [0.22, 0.61, 0.36, 1] }}
                        className="flex flex-col items-center gap-3"
                    >
                        <motion.div
                            initial={{ scale: reducedMotion ? 1 : 0 }}
                            animate={reducedMotion ? { scale: 1 } : { scale: [0, 1.12, 1] }}
                            transition={{ duration: 0.45, ease: [0.34, 1.56, 0.64, 1], delay: 0.08 }}
                            className="relative flex h-20 w-20 items-center justify-center rounded-full bg-[rgb(var(--paper-sage))] shadow-[0_14px_34px_rgba(138,154,111,0.34)]"
                        >
                            <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <motion.path
                                    d="M4 12.5l5 5 11-11"
                                    initial={{ pathLength: reducedMotion ? 1 : 0 }}
                                    animate={{ pathLength: 1 }}
                                    transition={{ duration: 0.4, delay: 0.28, ease: [0.22, 0.61, 0.36, 1] }}
                                />
                            </svg>
                            {!reducedMotion && (
                                <motion.span
                                    aria-hidden="true"
                                    className="absolute inset-0 rounded-full border-2 border-[rgb(var(--paper-sage))]"
                                    initial={{ scale: 1, opacity: 0.65 }}
                                    animate={{ scale: 1.55, opacity: 0 }}
                                    transition={{ duration: 0.85, ease: 'easeOut', delay: 0.18 }}
                                />
                            )}
                        </motion.div>
                        <motion.p
                            initial={{ opacity: 0, y: reducedMotion ? 0 : 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5, duration: 0.28 }}
                            className="text-lg italic"
                            style={{ fontFamily: 'var(--font-serif, Georgia, serif)', color: 'rgb(var(--paper-ink))' }}
                        >
                            {label}
                        </motion.p>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
