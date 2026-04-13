'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { NotebookDoodle } from '@/components/dashboard/NotebookDoodles';

const DISMISSED_KEY = 'notive_walkthrough_v1_dismissed';

type Step = {
    doodle: 'sprout' | 'ladder' | 'knot' | 'steady-me' | 'reach-someone' | 'see-my-growth' | 'shape-my-future';
    accent: 'sage' | 'sky' | 'lilac' | 'apricot' | 'amber';
    label: string;
    title: string;
    body: string;
    href: string;
    cta: string;
};

const STEPS: Step[] = [
    {
        doodle: 'ladder',
        accent: 'sky',
        label: 'Timeline',
        title: 'Look back as you grow',
        body: 'Every note you write appears here in order. Patterns and themes surface as entries accumulate.',
        href: '/timeline',
        cta: 'See the timeline →',
    },
    {
        doodle: 'sprout',
        accent: 'sage',
        label: 'Chapters',
        title: 'Group related moments',
        body: 'Collect entries into chapters — by project, semester, or anything that feels connected.',
        href: '/chapters',
        cta: 'Browse chapters →',
    },
    {
        doodle: 'see-my-growth',
        accent: 'lilac',
        label: 'Guide',
        title: 'Turn notes into next moves',
        body: 'Notive reads what you write and surfaces insights, prompts, and patterns to act on.',
        href: '/guide',
        cta: 'Open the guide →',
    },
];

export default function FirstVisitWalkthrough() {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        try {
            if (!localStorage.getItem(DISMISSED_KEY)) {
                setVisible(true);
            }
        } catch {
            // Private browsing — show once
            setVisible(true);
        }
    }, []);

    const dismiss = () => {
        try { localStorage.setItem(DISMISSED_KEY, '1'); } catch { /* ignore */ }
        setVisible(false);
    };

    return (
        <AnimatePresence>
            {visible && (
                <motion.section
                    key="walkthrough"
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.36, ease: 'easeOut' }}
                    className="notebook-shell rounded-[2.25rem] px-5 py-5 md:px-7 md:py-6"
                >
                    <div className="flex items-start justify-between gap-3 mb-4">
                        <div>
                            <p className="type-overline text-muted">What's in Notive</p>
                            <h2 className="notebook-title text-base mt-0.5">Three places to explore after your first note</h2>
                        </div>
                        <button
                            type="button"
                            aria-label="Dismiss walkthrough"
                            onClick={dismiss}
                            className="shrink-0 mt-0.5 rounded-full p-1 text-ink-muted hover:text-ink-secondary transition-colors"
                        >
                            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                                <path d="M4 4l8 8M12 4l-8 8" />
                            </svg>
                        </button>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        {STEPS.map((step, i) => (
                            <motion.div
                                key={step.label}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.08 + i * 0.07, duration: 0.32 }}
                            >
                                <Link
                                    href={step.href}
                                    className="group flex flex-col gap-2 rounded-[1.4rem] border border-[rgba(141,123,105,0.14)] bg-[rgba(255,255,255,0.54)] p-4 transition-all hover:border-[rgba(141,123,105,0.28)] hover:bg-[rgba(255,255,255,0.76)] hover:shadow-sm"
                                >
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 shrink-0 opacity-70">
                                            <NotebookDoodle name={step.doodle} accent={step.accent} />
                                        </div>
                                        <span className="type-overline text-muted">{step.label}</span>
                                    </div>
                                    <p className="text-sm font-semibold text-strong leading-snug">{step.title}</p>
                                    <p className="text-xs leading-relaxed text-ink-secondary">{step.body}</p>
                                    <span className="mt-auto text-[10px] font-semibold uppercase tracking-[0.12em] text-primary/60 group-hover:text-primary transition-colors">
                                        {step.cta}
                                    </span>
                                </Link>
                            </motion.div>
                        ))}
                    </div>

                    <button
                        type="button"
                        onClick={dismiss}
                        className="mt-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted hover:text-ink-secondary transition-colors"
                    >
                        Got it, hide this
                    </button>
                </motion.section>
            )}
        </AnimatePresence>
    );
}
