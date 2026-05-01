'use client';

import Link from 'next/link';
import { FiArrowRight, FiCheckCircle, FiCompass, FiTarget, FiZap } from 'react-icons/fi';
import type {
    DashboardHomeAction,
    DashboardHomePersona,
    DashboardHomeTakeaway,
    DashboardTakeawayTone,
} from '@/services/home-takeaway.service';

type DashboardTakeawayCardProps = {
    takeaway: DashboardHomeTakeaway;
    compact?: boolean;
};

const toneStyles: Record<DashboardTakeawayTone, {
    bg: string;
    border: string;
    text: string;
    soft: string;
    dot: string;
}> = {
    sage: {
        bg: 'bg-[rgba(138,154,111,0.14)]',
        border: 'border-[rgba(138,154,111,0.28)]',
        text: 'text-[rgb(104,124,80)]',
        soft: 'bg-[rgba(138,154,111,0.08)]',
        dot: 'bg-[rgb(138,154,111)]',
    },
    apricot: {
        bg: 'bg-[rgba(234,216,189,0.52)]',
        border: 'border-[rgba(190,142,92,0.24)]',
        text: 'text-[rgb(154,106,65)]',
        soft: 'bg-[rgba(234,216,189,0.28)]',
        dot: 'bg-[rgb(190,142,92)]',
    },
    lilac: {
        bg: 'bg-[rgba(216,199,232,0.36)]',
        border: 'border-[rgba(136,104,168,0.22)]',
        text: 'text-[rgb(112,88,138)]',
        soft: 'bg-[rgba(216,199,232,0.2)]',
        dot: 'bg-[rgb(136,104,168)]',
    },
    sky: {
        bg: 'bg-[rgba(191,214,221,0.42)]',
        border: 'border-[rgba(98,137,150,0.24)]',
        text: 'text-[rgb(78,114,126)]',
        soft: 'bg-[rgba(191,214,221,0.22)]',
        dot: 'bg-[rgb(98,137,150)]',
    },
    ink: {
        bg: 'bg-[rgba(92,92,92,0.08)]',
        border: 'border-[rgba(92,92,92,0.16)]',
        text: 'text-[rgb(var(--paper-ink-soft))]',
        soft: 'bg-[rgba(92,92,92,0.06)]',
        dot: 'bg-[rgb(var(--paper-ink-soft))]',
    },
};

const personaTone: Record<DashboardHomePersona, DashboardTakeawayTone> = {
    safety: 'apricot',
    new_user: 'sage',
    returning: 'apricot',
    checkin_due: 'sage',
    checked_in: 'sage',
    done_today: 'sage',
    story_ready: 'lilac',
    growth: 'apricot',
    pattern: 'sky',
    power_user: 'lilac',
    memory: 'sky',
};

const iconForPersona: Record<DashboardHomePersona, typeof FiCompass> = {
    safety: FiCheckCircle,
    new_user: FiZap,
    returning: FiCompass,
    checkin_due: FiTarget,
    checked_in: FiCheckCircle,
    done_today: FiCheckCircle,
    story_ready: FiZap,
    growth: FiTarget,
    pattern: FiCompass,
    power_user: FiCompass,
    memory: FiZap,
};

function TakeawayAction({ action, variant }: { action?: DashboardHomeAction; variant: 'primary' | 'secondary' }) {
    if (!action) return null;

    const className = variant === 'primary'
        ? 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[rgb(var(--paper-ink))] px-4 py-2.5 text-sm font-semibold text-[rgb(var(--paper-bg))] transition-transform hover:-translate-y-0.5 active:translate-y-0'
        : 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[rgba(92,92,92,0.14)] bg-[rgba(255,255,255,0.46)] px-4 py-2.5 text-sm font-semibold text-[rgb(var(--paper-ink))] transition-colors hover:bg-[rgba(255,255,255,0.72)]';

    if (action.kind === 'none') {
        return (
            <div className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[rgba(138,154,111,0.24)] bg-[rgba(138,154,111,0.1)] px-4 py-2.5 text-sm font-semibold text-[rgb(104,124,80)]">
                <FiCheckCircle size={15} aria-hidden="true" />
                <span>{action.label}</span>
            </div>
        );
    }

    if (!action.href) return null;

    const content = (
        <>
            <span>{action.label}</span>
            <FiArrowRight size={15} aria-hidden="true" />
        </>
    );

    if (action.href.startsWith('/')) {
        return (
            <Link href={action.href} className={className}>
                {content}
            </Link>
        );
    }

    return (
        <a href={action.href} className={className}>
            {content}
        </a>
    );
}

export default function DashboardTakeawayCard({ takeaway, compact = false }: DashboardTakeawayCardProps) {
    const tone = personaTone[takeaway.persona];
    const styles = toneStyles[tone];
    const PersonaIcon = iconForPersona[takeaway.persona];
    const visibleSignals = takeaway.signals.slice(0, compact ? 2 : 3);
    const detailSignals = takeaway.signals.slice(0, 4);
    const steps = [
        { label: 'Noticed', value: takeaway.eyebrow },
        { label: 'Matters', value: takeaway.why },
        { label: 'Next', value: takeaway.nextStep },
    ];

    return (
        <section
            className={`relative overflow-hidden rounded-[1.35rem] border ${styles.border} bg-[rgba(255,251,245,0.72)] px-4 py-4 shadow-[0_12px_28px_rgba(92,92,92,0.07)] md:rounded-[1.65rem] md:px-5 md:py-5`}
            aria-label="Dashboard takeaway"
        >
            <div className={`absolute inset-y-4 left-0 w-1 rounded-r-full ${styles.dot}`} aria-hidden="true" />

            <div className="flex items-start gap-3">
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${styles.border} ${styles.bg} ${styles.text}`}>
                    <PersonaIcon size={19} aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <p className="section-label">{takeaway.eyebrow}</p>
                        <span className={`rounded-full border px-2 py-0.5 text-[0.58rem] font-semibold uppercase tracking-[0.1em] ${styles.border} ${styles.bg} ${styles.text}`}>
                            {takeaway.personaLabel}
                        </span>
                    </div>
                    <h2 className={`${compact ? 'text-[1.25rem] md:text-[1.55rem]' : 'text-[1.45rem] md:text-[1.9rem]'} notebook-title mt-2 leading-tight`}>
                        {takeaway.headline}
                    </h2>
                    <p className="notebook-copy mt-2 max-w-2xl text-[0.9rem] leading-7">
                        {takeaway.body}
                    </p>
                </div>
            </div>

            <div className="mt-4 flex flex-col gap-3 rounded-[1rem] border border-[rgba(92,92,92,0.1)] bg-[rgba(255,255,255,0.38)] px-3 py-3 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                    <p className="text-[0.58rem] font-bold uppercase tracking-[0.12em] text-[rgb(var(--paper-ink-soft))]">
                        Next
                    </p>
                    <p className="mt-1 text-[0.86rem] font-semibold leading-6 text-[rgb(var(--paper-ink))]">
                        {takeaway.nextStep}
                    </p>
                </div>

                {visibleSignals.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                        {visibleSignals.map((signal) => {
                            const signalStyles = toneStyles[signal.tone];
                            return (
                                <span
                                    key={`${signal.label}-${signal.value}`}
                                    className={`inline-flex max-w-full items-center gap-1.5 rounded-full border ${signalStyles.border} ${signalStyles.soft} px-2.5 py-1 text-[0.68rem] font-semibold ${signalStyles.text}`}
                                >
                                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${signalStyles.dot}`} aria-hidden="true" />
                                    <span className="truncate">{signal.label}: {signal.value}</span>
                                </span>
                            );
                        })}
                    </div>
                )}
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <TakeawayAction action={takeaway.primaryAction} variant="primary" />
                <TakeawayAction action={takeaway.secondaryAction} variant="secondary" />
            </div>

            <details className="group mt-3 rounded-[0.95rem] border border-[rgba(92,92,92,0.1)] bg-[rgba(255,255,255,0.28)]">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5">
                    <span className="text-[0.68rem] font-semibold text-[rgb(var(--paper-ink-soft))]">
                        Why this takeaway?
                    </span>
                    <span className="text-[0.58rem] font-bold uppercase tracking-[0.1em] text-[rgb(var(--paper-ink-muted))] group-open:hidden">
                        Open
                    </span>
                    <span className="hidden text-[0.58rem] font-bold uppercase tracking-[0.1em] text-[rgb(var(--paper-ink-muted))] group-open:inline">
                        Hide
                    </span>
                </summary>

                <div className="border-t border-[rgba(92,92,92,0.1)] px-3 pb-3 pt-3">
                    <div className="flex items-start gap-2">
                        <FiCompass className={`mt-0.5 shrink-0 ${styles.text}`} size={16} aria-hidden="true" />
                        <p className="text-[0.78rem] leading-6 text-[rgb(var(--paper-ink))]">
                            {takeaway.why}
                        </p>
                    </div>

                    {!compact && (
                        <div className="mt-3 grid gap-2 md:grid-cols-3">
                            {steps.map((step, index) => (
                                <div key={step.label} className="flex items-start gap-2 rounded-[0.8rem] bg-[rgba(255,255,255,0.36)] px-3 py-2">
                                    <span className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[0.62rem] font-bold ${index === 0 ? styles.bg : 'bg-[rgba(92,92,92,0.08)]'} ${index === 0 ? styles.text : 'text-[rgb(var(--paper-ink-soft))]'}`}>
                                        {index + 1}
                                    </span>
                                    <div className="min-w-0">
                                        <p className="text-[0.56rem] font-bold uppercase tracking-[0.1em] text-[rgb(var(--paper-ink-soft))]">
                                            {step.label}
                                        </p>
                                        <p className="mt-0.5 text-[0.68rem] leading-5 text-[rgb(var(--paper-ink))]">
                                            {step.value}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {detailSignals.length > visibleSignals.length && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                            {detailSignals.slice(visibleSignals.length).map((signal) => {
                                const signalStyles = toneStyles[signal.tone];
                                return (
                                    <span
                                        key={`${signal.label}-${signal.value}`}
                                        className={`inline-flex items-center gap-1.5 rounded-full border ${signalStyles.border} ${signalStyles.soft} px-2.5 py-1 text-[0.64rem] font-semibold ${signalStyles.text}`}
                                    >
                                        <span className={`h-1.5 w-1.5 rounded-full ${signalStyles.dot}`} aria-hidden="true" />
                                        {signal.label}: {signal.value}
                                    </span>
                                );
                            })}
                        </div>
                    )}
                </div>
            </details>
        </section>
    );
}
