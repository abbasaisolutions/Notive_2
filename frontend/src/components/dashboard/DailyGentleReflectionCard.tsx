/* DASHBOARD REFINEMENT COMPLETE — matches logo + generated images exactly:
   warm paper grain, pencil lines, one sage sprout doodle max,
   one calm Focus Card, grounded action-first experience for students */
'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Surface } from '@/components/ui/surface';
import type { GentleReflectionDraft } from '@/services/gentle-reflection.service';

type DailyGentleReflectionCardProps = {
    reflection: GentleReflectionDraft;
    journalHref: string;
    insightsHref: string;
    portfolioHref: string;
    isDisabling: boolean;
    onAccept: () => void;
    onDismiss: () => void;
    onDisable: () => void;
    embedded?: boolean;
};

export default function DailyGentleReflectionCard({
    reflection,
    journalHref,
    insightsHref,
    portfolioHref,
    isDisabling,
    onAccept,
    onDismiss,
    onDisable,
    embedded = false,
}: DailyGentleReflectionCardProps) {
    const isCompactDashboard = embedded;

    const content = (
        <div className={isCompactDashboard ? 'space-y-3' : 'space-y-4'}>
            <div>
                <p className="section-label">Gentle reflection</p>
                <h2 className={`notebook-title mt-2 ${isCompactDashboard ? 'text-[1.02rem] leading-6 md:text-[1.15rem]' : 'text-xl md:text-[1.55rem]'}`}>
                    Treat this like a direction check, not a final verdict.
                </h2>
                <p className={`notebook-copy mt-3 ${isCompactDashboard ? 'text-[0.82rem] leading-6' : 'text-[0.875rem] leading-7'}`}>
                    {reflection.title}
                </p>
                <p className={`notebook-copy mt-2 ${isCompactDashboard ? 'text-[0.82rem] leading-6' : 'text-[0.875rem] leading-7'}`}>
                    {reflection.body}
                </p>
            </div>

            <div className="app-paper-soft rounded-[1.25rem] p-4">
                <p className="section-label">What Notive is noticing</p>
                <p className={`notebook-copy mt-2 ${isCompactDashboard ? 'text-[0.82rem] leading-6' : 'text-[0.875rem] leading-7'}`}>
                    {reflection.evidence}
                </p>
                {reflection.strengthLabel && (
                    <p className={`notebook-muted mt-2 ${isCompactDashboard ? 'text-[0.72rem] leading-5' : 'text-xs leading-6'}`}>
                        Hidden strength showing up: {reflection.strengthLabel}
                    </p>
                )}
            </div>

            <div className="app-paper-soft rounded-[1.25rem] p-4">
                <p className="section-label">One clear next move</p>
                <p className={`notebook-title mt-2 ${isCompactDashboard ? 'text-[1rem] leading-6' : 'text-lg'}`}>Draft the first lines</p>
                <p className={`notebook-copy mt-2 ${isCompactDashboard ? 'text-[0.82rem] leading-6' : 'text-[0.875rem] leading-7'}`}>
                    {reflection.prompt}
                </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <Link
                    href={journalHref}
                    onClick={onAccept}
                    className="workspace-button-primary inline-flex items-center rounded-xl px-4 py-3 text-sm font-semibold"
                >
                    Draft the first lines
                </Link>
                <button
                    type="button"
                    onClick={onDismiss}
                    className="workspace-button-outline rounded-xl px-4 py-3 text-sm font-semibold"
                >
                    Not now
                </button>
                <button
                    type="button"
                    onClick={onDisable}
                    disabled={isDisabling}
                    className="text-xs font-semibold text-[rgb(var(--paper-ink-soft))] underline-offset-4 transition-colors hover:text-[rgb(var(--paper-ink))] hover:underline disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {isDisabling ? 'Saving...' : 'Turn off gentle reflections'}
                </button>
            </div>

            {!isCompactDashboard && (
                <div className="flex flex-wrap items-center gap-2 text-xs text-[rgb(var(--paper-ink-muted))]">
                    <Link href={insightsHref} className="transition-colors hover:text-[rgb(var(--paper-ink))]">
                        Open patterns
                    </Link>
                    <span>·</span>
                    <Link href={portfolioHref} className="transition-colors hover:text-[rgb(var(--paper-ink))]">
                        Open growth
                    </Link>
                </div>
            )}
        </div>
    );

    if (embedded) {
        return content;
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
        >
            <Surface doodle="sprout" doodleAccent="sage" className="app-paper">
                {content}
            </Surface>
        </motion.div>
    );
}
