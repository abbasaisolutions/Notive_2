'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiEdit3, FiMic, FiStar } from 'react-icons/fi';
import { MIN_WORDS_FOR_ENTRY_INSIGHTS } from '@/constants/entry-requirements';

const TIPS = [
    { icon: FiEdit3, text: 'Write whatever comes to mind — no right or wrong.' },
    { icon: FiMic, text: 'Prefer talking? Tap the mic to speak your thoughts.' },
    { icon: FiStar, text: `After ${MIN_WORDS_FOR_ENTRY_INSIGHTS} words, I\u2019ll uncover patterns and insights for you.` },
];

export default function FirstEntryHandoff({ onDismiss }: { onDismiss: () => void }) {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        // Slight delay so the page has rendered beneath
        const show = setTimeout(() => setVisible(true), 600);
        const auto = setTimeout(() => {
            setVisible(false);
            setTimeout(onDismiss, 350);
        }, 10000);
        return () => { clearTimeout(show); clearTimeout(auto); };
    }, [onDismiss]);

    const handleDismiss = () => {
        setVisible(false);
        setTimeout(onDismiss, 350);
    };

    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
                    onClick={handleDismiss}
                >
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" />

                    {/* Card */}
                    <motion.div
                        initial={{ y: 40, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 20, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                        className="relative w-full max-w-sm workspace-panel rounded-2xl shadow-xl p-5"
                        onClick={e => e.stopPropagation()}
                    >
                        <p className="text-sm font-semibold text-strong mb-1">
                            Welcome to your notebook
                        </p>
                        <p className="text-xs text-ink-muted mb-4">
                            This is your first entry. Here are a few pointers:
                        </p>

                        <div className="space-y-3">
                            {TIPS.map(({ icon: Icon, text }, i) => (
                                <div key={i} className="flex items-start gap-3">
                                    <div className="shrink-0 mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-[rgba(138,154,111,0.12)]">
                                        <Icon size={14} className="text-[rgb(var(--paper-sage))]" />
                                    </div>
                                    <p className="text-xs text-ink-secondary leading-relaxed pt-1">{text}</p>
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={handleDismiss}
                            className="mt-5 w-full rounded-xl bg-[rgb(var(--paper-sage))] py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[rgb(var(--paper-sage))]/90"
                        >
                            Got it — let&apos;s start
                        </button>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
