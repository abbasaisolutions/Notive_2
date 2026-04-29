'use client';

import React, { useEffect, useState } from 'react';
import useApi from '@/hooks/use-api';
import { TagPill } from '@/components/ui/surface';

type ForecastDay = {
    day: string;
    dayIndex: number;
    averageScore: number;
    sampleSize: number;
    delta: number;
};

type MoodForecast = {
    confidence: 'low' | 'medium' | 'high';
    sampleSize: number;
    windowDays: number;
    personalAverage: number;
    weakDays: ForecastDay[];
    strongDays: ForecastDay[];
    nextWeakDay: { day: string; daysAway: number } | null;
    nextStrongDay: { day: string; daysAway: number } | null;
    gentleNote: string | null;
};

const DISMISS_STORAGE_KEY = 'notive_mood_forecast_dismissed_until';
const DISMISS_DURATION_MS = 1000 * 60 * 60 * 24 * 3;

const getDaysAwayLabel = (daysAway: number): string => {
    if (daysAway === 1) return 'tomorrow';
    if (daysAway <= 3) return `in ${daysAway} days`;
    return 'this week';
};

export default function MoodForecastCard() {
    const { apiFetch } = useApi();
    const [forecast, setForecast] = useState<MoodForecast | null>(null);
    const [loading, setLoading] = useState(true);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        try {
            const raw = typeof window !== 'undefined' ? window.localStorage.getItem(DISMISS_STORAGE_KEY) : null;
            if (raw && Number(raw) > Date.now()) setDismissed(true);
        } catch {
            // ignore storage errors
        }
    }, []);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const response = await apiFetch('/analytics/mood-forecast');
                if (!response.ok) return;
                const data = (await response.json()) as MoodForecast;
                if (!cancelled) setForecast(data);
            } catch {
                // silent — forecast is non-critical
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [apiFetch]);

    const handleDismiss = () => {
        setDismissed(true);
        try {
            window.localStorage.setItem(DISMISS_STORAGE_KEY, String(Date.now() + DISMISS_DURATION_MS));
        } catch {
            // ignore storage errors
        }
    };

    if (loading || dismissed || !forecast) return null;
    if (forecast.confidence === 'low') return null;
    if (forecast.weakDays.length === 0 && forecast.strongDays.length === 0) return null;

    const weak = forecast.nextWeakDay;
    const strong = forecast.nextStrongDay;
    const primaryLine = weak
        ? `${weak.day} ${getDaysAwayLabel(weak.daysAway)} tends to run a little heavier.`
        : strong
            ? `${strong.day} ${getDaysAwayLabel(strong.daysAway)} usually feels lighter.`
            : forecast.gentleNote;

    const secondaryLine = weak && strong
        ? `Your ${strong.day}s average higher — plan something gentle for ${weak.day}.`
        : 'Based on the last few weeks of your entries.';

    return (
        <div className="notebook-card-soft rounded-2xl p-4">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <p
                        className="section-label"
                        style={{ fontStyle: 'italic', fontFamily: 'var(--font-serif, Georgia, serif)' }}
                    >
                        A soft pattern
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                        <TagPill tone={forecast.confidence === 'high' ? 'primary' : 'default'}>
                            {forecast.confidence === 'high' ? 'Higher confidence' : 'Medium confidence'}
                        </TagPill>
                        <TagPill>{forecast.sampleSize} entries</TagPill>
                        <TagPill>{forecast.windowDays} day window</TagPill>
                    </div>
                    <p
                        className="notebook-copy mt-3 text-[0.92rem] leading-relaxed"
                        style={{ color: 'rgb(var(--paper-ink))' }}
                    >
                        {primaryLine}
                    </p>
                    <p
                        className="notebook-muted mt-1 text-[0.78rem]"
                        style={{ color: 'rgb(155 143 120)' }}
                    >
                        {secondaryLine} This is a pattern read, not a prediction.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={handleDismiss}
                    className="notebook-muted shrink-0 rounded-full px-2 py-1 text-[0.7rem] transition-opacity hover:opacity-70"
                    style={{ color: 'rgb(155 143 120)' }}
                    aria-label="Hide this gentle pattern"
                >
                    Hide
                </button>
            </div>
        </div>
    );
}
