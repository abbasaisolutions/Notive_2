'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { FiArrowLeft, FiBookOpen, FiFeather, FiHeart, FiStar } from 'react-icons/fi';
import useAuthRedirect from '@/hooks/use-auth-redirect';
import { useAnalytics } from '@/hooks/useAnalytics';
import { Spinner } from '@/components/ui';

type ReviewPeriod = 'month' | 'year';

const PERIOD_LABELS: Record<ReviewPeriod, { tab: string; subject: string }> = {
    month: { tab: 'This month', subject: 'month' },
    year: { tab: 'This year', subject: 'year' },
};

const MIN_ENTRIES_FOR_REVIEW = 5;

function PeriodTabs({ period, onChange }: { period: ReviewPeriod; onChange: (value: ReviewPeriod) => void }) {
    return (
        <div className="inline-flex rounded-full border border-[rgba(0,0,0,0.08)] bg-[rgba(0,0,0,0.02)] p-1">
            {(['month', 'year'] as const).map((value) => {
                const active = value === period;
                return (
                    <button
                        key={value}
                        type="button"
                        onClick={() => onChange(value)}
                        className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                            active
                                ? 'bg-[rgb(var(--brand-strong))] text-white shadow-sm'
                                : 'text-[rgb(var(--paper-ink-soft))] hover:text-[rgb(var(--paper-ink))]'
                        }`}
                        aria-pressed={active}
                    >
                        {PERIOD_LABELS[value].tab}
                    </button>
                );
            })}
        </div>
    );
}

export default function ReviewPage() {
    useAuthRedirect();
    const [period, setPeriod] = useState<ReviewPeriod>('month');
    const { analytics, signature, isLoading, error } = useAnalytics(period);

    const titleCase = (value: string) =>
        value
            .split(/[\s_-]+/g)
            .filter(Boolean)
            .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
            .join(' ');

    const insufficient = !isLoading && !error && analytics.totalEntries < MIN_ENTRIES_FOR_REVIEW;
    const subject = PERIOD_LABELS[period].subject;

    const topMoodLabel = useMemo(() => {
        if (!analytics.topMood || analytics.topMood === 'neutral') return null;
        return titleCase(analytics.topMood);
    }, [analytics.topMood]);

    return (
        <main className="min-h-screen bg-[rgb(var(--bg-canvas))] pb-[max(3rem,env(safe-area-inset-bottom))]">
            <div className="mx-auto w-full max-w-2xl px-5 pt-8">
                <div className="flex items-center justify-between gap-3">
                    <Link
                        href="/dashboard"
                        className="notebook-muted inline-flex items-center gap-1.5 text-sm transition-opacity hover:opacity-80"
                        style={{ color: 'rgb(155 143 120)' }}
                    >
                        <FiArrowLeft size={14} aria-hidden="true" />
                        <span>Dashboard</span>
                    </Link>
                    <PeriodTabs period={period} onChange={setPeriod} />
                </div>

                {isLoading ? (
                    <div className="flex min-h-[50vh] items-center justify-center">
                        <Spinner size="md" />
                    </div>
                ) : error ? (
                    <div className="notebook-card-soft mt-8 rounded-2xl p-6 text-center text-sm" style={{ color: 'rgb(var(--paper-ink-soft))' }}>
                        We couldn&rsquo;t load your review right now. Try again in a moment.
                    </div>
                ) : insufficient ? (
                    <div className="notebook-card-soft mt-8 rounded-2xl p-6 text-center">
                        <p
                            className="section-label"
                            style={{ fontStyle: 'italic', fontFamily: 'var(--font-serif, Georgia, serif)' }}
                        >
                            Almost there
                        </p>
                        <p className="notebook-copy mt-2 text-sm leading-relaxed" style={{ color: 'rgb(var(--paper-ink))' }}>
                            A review needs a few more entries before it will feel meaningful. Keep writing, and your {subject} will come together here.
                        </p>
                        <Link
                            href="/entry/new"
                            className="mt-4 inline-flex items-center gap-2 rounded-full bg-[rgb(var(--brand-strong))] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                        >
                            <FiFeather size={14} aria-hidden="true" />
                            <span>Write an entry</span>
                        </Link>
                    </div>
                ) : (
                    <>
                        {/* Hero */}
                        <header className="mt-6">
                            <p
                                className="section-label"
                                style={{ fontStyle: 'italic', fontFamily: 'var(--font-serif, Georgia, serif)' }}
                            >
                                Your {subject} in review
                            </p>
                            <h1
                                className="mt-2 text-3xl font-serif leading-tight"
                                style={{ color: 'rgb(var(--paper-ink))' }}
                            >
                                {signature.editorialRecap.title}
                            </h1>
                            <p
                                className="notebook-copy mt-4 text-base leading-relaxed"
                                style={{ color: 'rgb(var(--paper-ink-soft))' }}
                            >
                                {signature.editorialRecap.summary}
                            </p>
                        </header>

                        {/* Stats strip */}
                        <section className="mt-6 grid grid-cols-3 gap-3">
                            <div className="notebook-card-soft rounded-2xl p-3 text-center">
                                <p className="notebook-muted text-[0.7rem] uppercase tracking-[0.12em]" style={{ color: 'rgb(155 143 120)' }}>
                                    Entries
                                </p>
                                <p className="mt-1 font-serif text-xl" style={{ color: 'rgb(var(--paper-ink))' }}>
                                    {analytics.totalEntries}
                                </p>
                            </div>
                            <div className="notebook-card-soft rounded-2xl p-3 text-center">
                                <p className="notebook-muted text-[0.7rem] uppercase tracking-[0.12em]" style={{ color: 'rgb(155 143 120)' }}>
                                    Active days
                                </p>
                                <p className="mt-1 font-serif text-xl" style={{ color: 'rgb(var(--paper-ink))' }}>
                                    {analytics.activeDays}
                                </p>
                            </div>
                            <div className="notebook-card-soft rounded-2xl p-3 text-center">
                                <p className="notebook-muted text-[0.7rem] uppercase tracking-[0.12em]" style={{ color: 'rgb(155 143 120)' }}>
                                    Avg words
                                </p>
                                <p className="mt-1 font-serif text-xl" style={{ color: 'rgb(var(--paper-ink))' }}>
                                    {analytics.avgWordCount}
                                </p>
                            </div>
                        </section>

                        {/* Pattern signal */}
                        {signature.patternDigest.primary && (
                            <section className="notebook-card-soft mt-6 rounded-2xl p-5">
                                <div className="flex items-start gap-3">
                                    <div className="mt-1 shrink-0 text-[rgb(var(--brand-strong))]">
                                        <FiStar size={18} aria-hidden="true" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p
                                            className="section-label"
                                            style={{ fontStyle: 'italic', fontFamily: 'var(--font-serif, Georgia, serif)' }}
                                        >
                                            {signature.patternDigest.primary.label}
                                        </p>
                                        <p
                                            className="mt-1 font-semibold"
                                            style={{ color: 'rgb(var(--paper-ink))' }}
                                        >
                                            {signature.patternDigest.primary.title}
                                        </p>
                                        <p
                                            className="notebook-copy mt-2 text-sm leading-relaxed"
                                            style={{ color: 'rgb(var(--paper-ink-soft))' }}
                                        >
                                            {signature.patternDigest.primary.summary}
                                        </p>
                                    </div>
                                </div>
                            </section>
                        )}

                        {/* Highlights */}
                        {signature.editorialRecap.highlights.length > 0 && (
                            <section className="mt-6">
                                <p
                                    className="section-label"
                                    style={{ fontStyle: 'italic', fontFamily: 'var(--font-serif, Georgia, serif)' }}
                                >
                                    Moments that stood out
                                </p>
                                <ul className="mt-3 space-y-3">
                                    {signature.editorialRecap.highlights.map((highlight, index) => (
                                        <li
                                            key={index}
                                            className="notebook-card-soft rounded-2xl p-4 text-sm leading-relaxed"
                                            style={{ color: 'rgb(var(--paper-ink))' }}
                                        >
                                            {highlight}
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        )}

                        {/* Top themes */}
                        {analytics.topThemes.length > 0 && (
                            <section className="mt-6">
                                <p
                                    className="section-label"
                                    style={{ fontStyle: 'italic', fontFamily: 'var(--font-serif, Georgia, serif)' }}
                                >
                                    What you kept circling back to
                                </p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {analytics.topThemes.slice(0, 8).map((theme) => (
                                        <span
                                            key={theme.theme}
                                            className="rounded-full border border-[rgba(0,0,0,0.08)] bg-[rgba(0,0,0,0.03)] px-3 py-1 text-sm"
                                            style={{ color: 'rgb(var(--paper-ink))' }}
                                        >
                                            {titleCase(theme.theme)} · {theme.count}
                                        </span>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* Mood snapshot */}
                        {topMoodLabel && (
                            <section className="notebook-card-soft mt-6 rounded-2xl p-5">
                                <div className="flex items-start gap-3">
                                    <div className="mt-1 shrink-0" style={{ color: 'rgb(var(--brand-strong))' }}>
                                        <FiHeart size={18} aria-hidden="true" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p
                                            className="section-label"
                                            style={{ fontStyle: 'italic', fontFamily: 'var(--font-serif, Georgia, serif)' }}
                                        >
                                            Dominant feeling
                                        </p>
                                        <p
                                            className="mt-1 font-semibold"
                                            style={{ color: 'rgb(var(--paper-ink))' }}
                                        >
                                            {topMoodLabel}
                                        </p>
                                        <p
                                            className="notebook-copy mt-2 text-sm leading-relaxed"
                                            style={{ color: 'rgb(var(--paper-ink-soft))' }}
                                        >
                                            This was the color most of your {subject} was written in.
                                        </p>
                                    </div>
                                </div>
                            </section>
                        )}

                        {/* Then / Now — only meaningful for year */}
                        {period === 'year' && signature.thenNow && (
                            <section className="notebook-card-soft mt-6 rounded-2xl p-5">
                                <p
                                    className="section-label"
                                    style={{ fontStyle: 'italic', fontFamily: 'var(--font-serif, Georgia, serif)' }}
                                >
                                    Then &amp; now
                                </p>
                                <p className="notebook-copy mt-2 text-sm leading-relaxed" style={{ color: 'rgb(var(--paper-ink))' }}>
                                    {signature.thenNow.prompt}
                                </p>
                                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                    <Link
                                        href={`/entry/view?id=${signature.thenNow.thenEntry.id}`}
                                        className="rounded-2xl border border-[rgba(0,0,0,0.08)] bg-[rgba(0,0,0,0.02)] p-3 transition-colors hover:bg-[rgba(0,0,0,0.04)]"
                                    >
                                        <p className="notebook-muted text-[0.7rem] uppercase tracking-[0.12em]" style={{ color: 'rgb(155 143 120)' }}>
                                            {signature.thenNow.daysBetween} days ago
                                        </p>
                                        <p className="mt-1 text-sm font-semibold" style={{ color: 'rgb(var(--paper-ink))' }}>
                                            {signature.thenNow.thenEntry.title || 'Untitled note'}
                                        </p>
                                    </Link>
                                    <Link
                                        href={`/entry/view?id=${signature.thenNow.nowEntry.id}`}
                                        className="rounded-2xl border border-[rgba(0,0,0,0.08)] bg-[rgba(0,0,0,0.02)] p-3 transition-colors hover:bg-[rgba(0,0,0,0.04)]"
                                    >
                                        <p className="notebook-muted text-[0.7rem] uppercase tracking-[0.12em]" style={{ color: 'rgb(155 143 120)' }}>
                                            Recent
                                        </p>
                                        <p className="mt-1 text-sm font-semibold" style={{ color: 'rgb(var(--paper-ink))' }}>
                                            {signature.thenNow.nowEntry.title || 'Untitled note'}
                                        </p>
                                    </Link>
                                </div>
                            </section>
                        )}

                        {/* Closing prompt */}
                        <section className="mt-8">
                            <div className="rounded-2xl border-2 border-dashed border-[rgba(var(--brand-strong),0.35)] bg-[rgba(var(--brand-strong),0.04)] p-5">
                                <div className="flex items-start gap-3">
                                    <div className="mt-1 shrink-0" style={{ color: 'rgb(var(--brand-strong))' }}>
                                        <FiBookOpen size={18} aria-hidden="true" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p
                                            className="section-label"
                                            style={{ fontStyle: 'italic', fontFamily: 'var(--font-serif, Georgia, serif)' }}
                                        >
                                            A prompt before you close this
                                        </p>
                                        <p
                                            className="notebook-copy mt-2 text-base leading-relaxed"
                                            style={{ color: 'rgb(var(--paper-ink))' }}
                                        >
                                            {signature.editorialRecap.nextPrompt}
                                        </p>
                                        <Link
                                            href={`/entry/new?prompt=${encodeURIComponent(signature.editorialRecap.nextPrompt)}`}
                                            className="mt-4 inline-flex items-center gap-2 rounded-full bg-[rgb(var(--brand-strong))] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                                        >
                                            <FiFeather size={14} aria-hidden="true" />
                                            <span>Write to this prompt</span>
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        </section>
                    </>
                )}
            </div>
        </main>
    );
}
