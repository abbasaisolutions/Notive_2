/**
 * DashboardTier1Simple — Calm, minimal dashboard for new/early users (<10 entries)
 * 
 * Shows:
 * 1. Greeting + today's date
 * 2. Single action (Continue draft OR Capture memory)
 * 3. Latest memory preview (if exists)
 * 4. "What Notive Noticed" (collapsible insights)
 * 5. "Show detailed view" link
 * 
 * Goal: Minimal decisions, calm UX, progressive disclosure
 */

'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { getMoodEmoji, normalizeMood } from '@/constants/moods';

interface Tier1Entry {
  id: string;
  title: string | null;
  content: string;
  mood: string | null;
  createdAt: string;
}

interface DashboardAction {
  label: string;
  href?: string;
  onClick?: () => void;
  type?: 'button';
  tone?: 'primary' | 'secondary';
}

interface DashboardTier1SimpleProps {
  firstName: string;
  todayLabel: string;
  entries: Tier1Entry[];
  focusCard: {
    title: string;
    body: string;
    primaryAction?: DashboardAction | null;
  } | null;
  heroInsight: { body: string } | null;
  dashboardInsights?: {
    correlations: Array<{ topic: string; direction: 'lifter' | 'drain' }>;
    triggerMap: Array<{ entity: string; direction: 'lifter' | 'drain' }>;
  } | null;
  /** Callback to switch to full dashboard */
  onViewFullDashboard?: () => void;
}

const moodEmojiFor = (mood: string | null | undefined) => {
  if (!mood) return '✦';
  const normalized = normalizeMood(mood);
  return normalized ? getMoodEmoji(normalized) : '✦';
};

const truncateText = (text: string, maxLength: number) => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + '…';
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

export default function DashboardTier1Simple({
  firstName,
  todayLabel,
  entries,
  focusCard,
  heroInsight,
  dashboardInsights,
  onViewFullDashboard,
}: DashboardTier1SimpleProps) {
  const latestEntry = entries[0] || null;
  const primaryAction = focusCard?.primaryAction || null;
  const primaryActionClassName = 'block w-full rounded-2xl bg-[rgb(var(--brand))] text-white px-6 py-4 text-center font-medium transition-colors hover:opacity-90 active:opacity-80';

  // Extract first 2 lines of latest entry for preview
  const latestPreview = useMemo(() => {
    if (!latestEntry) return null;
    const lines = (latestEntry.content || '')
      .split('\n')
      .filter((line) => line.trim())
      .slice(0, 2)
      .join('\n');
    return truncateText(lines, 120);
  }, [latestEntry]);

  // Get top trigger/pattern for "What Notive Noticed"
  const topPattern = useMemo(() => {
    if (!dashboardInsights) return null;
    const triggers = dashboardInsights.triggerMap || [];
    const correlations = dashboardInsights.correlations || [];
    
    if (triggers.length > 0) {
      return triggers[0];
    }
    if (correlations.length > 0) {
      return correlations[0];
    }
    return null;
  }, [dashboardInsights]);
  const topPatternLabel = topPattern
    ? 'topic' in topPattern
      ? topPattern.topic
      : topPattern.entity
    : null;

  return (
    <div className="min-h-screen pb-32 md:pb-20">
      <main className="mx-auto w-full max-w-3xl px-4 py-6 md:px-6 md:py-10 space-y-5">
        {/* ── Header Block ────────────────────────────────────────── */}
        <section className="notebook-shell rounded-[2.25rem] px-5 py-5 md:px-7 md:py-6">
          <h1 className="notebook-title text-[23px] font-bold leading-tight">
            Hey {firstName}.
          </h1>
          <p className="notebook-muted mt-2 text-sm font-serif">
            {todayLabel}
          </p>
        </section>

        {/* ── Primary Action Block ────────────────────────────────── */}
        {focusCard && primaryAction && (
          <section className="space-y-3">
            {primaryAction.href ? (
              <Link
                href={primaryAction.href}
                onClick={primaryAction.onClick}
                className={primaryActionClassName}
              >
                {primaryAction.label}
              </Link>
            ) : (
              <button
                type="button"
                onClick={primaryAction.onClick}
                className={primaryActionClassName}
              >
                {primaryAction.label}
              </button>
            )}
            {focusCard.body && (
              <p className="notebook-muted text-center text-sm">
                {truncateText(focusCard.body, 140)}
              </p>
            )}
          </section>
        )}

        {/* ── Latest Memory Card ──────────────────────────────────── */}
        {latestEntry && latestPreview && (
          <section className="workspace-soft-panel rounded-2xl border border-[rgba(var(--brand),0.22)] p-4 hover:border-[rgba(var(--brand),0.42)] transition-colors">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 text-lg">
                {moodEmojiFor(latestEntry.mood)}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold truncate">
                  {latestEntry.title || 'Untitled memory'}
                </h3>
                <p className="notebook-muted text-sm mt-1 line-clamp-2">
                  {latestPreview}
                </p>
                <p className="notebook-muted text-xs mt-2">
                  {formatDate(latestEntry.createdAt)}
                </p>
              </div>
              <Link
                href={`/entry/view?id=${latestEntry.id}`}
                className="flex-shrink-0 text-xs font-medium text-[rgb(var(--brand))] hover:underline"
              >
                Open →
              </Link>
            </div>
          </section>
        )}

        {/* ── What Notive Noticed (Collapsible) ───────────────────── */}
        {(heroInsight || topPattern) && (
          <section>
            <details
              className="group cursor-pointer rounded-2xl border border-[rgba(var(--brand),0.22)] p-4 hover:border-[rgba(var(--brand),0.42)] transition-colors"
              open={false}
            >
              <summary className="font-medium select-none flex items-center gap-2">
                <span>What Notive noticed</span>
                <svg
                  className="w-4 h-4 transition-transform group-open:rotate-180"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 14l-7 7m0 0l-7-7m7 7V3"
                  />
                </svg>
              </summary>
              
              <div className="mt-4 space-y-3 pt-4 border-t border-[rgba(var(--brand),0.15)]">
                {/* Hero Insight */}
                {heroInsight && (
                  <div>
                    <p className="text-xs font-semibold text-[rgba(var(--text-accent))] uppercase tracking-wide mb-2">
                      Summary
                    </p>
                    <p className="notebook-copy text-sm">
                      {truncateText(heroInsight.body, 200)}
                    </p>
                  </div>
                )}

                {/* Top Pattern/Trigger */}
                {topPattern && (
                  <div>
                    <p className="text-xs font-semibold text-[rgba(var(--text-accent))] uppercase tracking-wide mb-2">
                      Pattern
                    </p>
                    <p className="notebook-copy text-sm">
                      <span className="font-medium">
                        {topPatternLabel}
                      </span>
                      {' '}
                      <span className="text-xs">
                        {topPattern.direction === 'lifter' && '↑ energizes'}
                        {topPattern.direction === 'drain' && '↓ drains'}
                      </span>
                    </p>
                  </div>
                )}

                {/* Footer hint */}
                <p className="text-xs notebook-muted italic pt-2">
                  More patterns appear as you add memories.
                </p>
              </div>
            </details>
          </section>
        )}

        {/* ── View Full Dashboard Link ────────────────────────────── */}
        <div className="pt-4 border-t border-[rgba(var(--brand),0.15)]">
          <button
            onClick={onViewFullDashboard}
            className="text-sm font-medium text-[rgb(var(--brand))] hover:underline"
          >
            Show detailed view →
          </button>
          <p className="text-xs notebook-muted mt-1">
            Patterns, growth, and extra details.
          </p>
        </div>
      </main>
    </div>
  );
}
