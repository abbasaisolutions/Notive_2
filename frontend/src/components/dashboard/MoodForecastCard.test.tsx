import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MoodForecastCard from './MoodForecastCard';

const apiFetchMock = vi.hoisted(() => vi.fn());

vi.mock('@/hooks/use-api', () => ({
    default: () => ({ apiFetch: apiFetchMock }),
}));

const forecastResponse = {
    confidence: 'medium',
    sampleSize: 12,
    windowDays: 42,
    personalAverage: 6.8,
    weakDays: [
        {
            day: 'Tuesday',
            dayIndex: 2,
            averageScore: 5.1,
            sampleSize: 4,
            delta: -1.7,
        },
    ],
    strongDays: [],
    nextWeakDay: {
        day: 'Tuesday',
        daysAway: 2,
    },
    nextStrongDay: null,
    gentleNote: 'Tuesdays tend to carry more pressure.',
};

const jsonResponse = (body: unknown, status = 200) => new Response(
    JSON.stringify(body),
    {
        status,
        headers: { 'Content-Type': 'application/json' },
    }
);

describe('MoodForecastCard', () => {
    beforeEach(() => {
        apiFetchMock.mockResolvedValue(jsonResponse(forecastResponse));
        try {
            if (typeof window.localStorage?.removeItem === 'function') {
                window.localStorage.removeItem('notive_mood_forecast_dismissed_until');
            }
        } catch {
            // Storage can be unavailable in some test environments.
        }
    });

    afterEach(() => {
        apiFetchMock.mockReset();
    });

    it('requests the mood forecast from the analytics API path', async () => {
        render(<MoodForecastCard />);

        await waitFor(() => {
            expect(apiFetchMock).toHaveBeenCalledWith('/analytics/mood-forecast');
        });

        expect(await screen.findByText(/Tuesday in 2 days tends to run a little heavier/i)).toBeInTheDocument();
    });
});
