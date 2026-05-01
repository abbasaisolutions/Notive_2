import { describe, expect, it } from 'vitest';
import {
    buildDashboardHomeTakeaway,
    DASHBOARD_QUICK_CHECKIN_ID,
} from './home-takeaway.service';

const baseInput = {
    entries: [],
    hasCheckedInToday: false,
    recommendedHref: '/entry/new?mode=quick',
    portfolioHref: '/portfolio?view=growth',
    timelineHref: '/timeline',
    guideHref: '/chat',
    now: new Date('2026-05-01T12:00:00.000Z'),
};

describe('buildDashboardHomeTakeaway', () => {
    it('gives new users a first memory takeaway', () => {
        const takeaway = buildDashboardHomeTakeaway({
            ...baseInput,
            focusCard: {
                title: 'Start with one real moment.',
                body: 'Capture one detail from today.',
                primaryAction: { label: 'Write first memory', href: '/entry/new?mode=quick' },
            },
        });

        expect(takeaway.persona).toBe('new_user');
        expect(takeaway.headline).toContain('one real moment');
        expect(takeaway.primaryAction.href).toBe('/entry/new?mode=quick');
    });

    it('prioritizes a gentle restart after a gap', () => {
        const takeaway = buildDashboardHomeTakeaway({
            ...baseInput,
            entries: [
                {
                    title: 'Hello again',
                    content: 'A short note.',
                    mood: 'thoughtful',
                    createdAt: '2026-04-22T12:00:00.000Z',
                },
            ],
        });

        expect(takeaway.persona).toBe('returning');
        expect(takeaway.primaryAction.kind).toBe('anchor');
        expect(takeaway.primaryAction.href).toBe(`#${DASHBOARD_QUICK_CHECKIN_ID}`);
        expect(takeaway.signals.some((signal) => signal.label === 'Gap')).toBe(true);
    });

    it('asks active users for a mood when there is no stronger takeaway yet', () => {
        const takeaway = buildDashboardHomeTakeaway({
            ...baseInput,
            entries: [
                {
                    title: 'Yesterday note',
                    content: 'A short memory from yesterday.',
                    mood: 'thoughtful',
                    createdAt: '2026-04-30T09:00:00.000Z',
                },
            ],
        });

        expect(takeaway.persona).toBe('checkin_due');
        expect(takeaway.primaryAction.href).toBe(`#${DASHBOARD_QUICK_CHECKIN_ID}`);
        expect(takeaway.secondaryAction?.href).toBe('/entry/new?mode=quick');
    });

    it('moves to done for now after today is checked in, even with ready stories', () => {
        const takeaway = buildDashboardHomeTakeaway({
            ...baseInput,
            hasCheckedInToday: true,
            todayCheckInMood: 'calm',
            entries: [
                {
                    title: 'Handled the hard conversation',
                    content: 'I stayed direct and kind.',
                    mood: 'calm',
                    createdAt: '2026-05-01T09:00:00.000Z',
                },
            ],
            storyOverview: {
                stats: { entryCount: 6, experienceCount: 3, verifiedCount: 1 },
                experiences: [
                    { verified: true, completeness: { readyForExport: true, readyForVerification: true } },
                    { verified: false, completeness: { readyForExport: false, readyForVerification: true } },
                ],
                topSkills: ['leadership'],
                topLessons: [],
            },
        });

        expect(takeaway.persona).toBe('done_today');
        expect(takeaway.headline).toContain("Calm is part of today's thread");
        expect(takeaway.primaryAction.kind).toBe('none');
        expect(takeaway.secondaryAction?.href).toBe('/portfolio?view=growth');
    });

    it('gives permission to stop after a full entry today without forcing check-in', () => {
        const takeaway = buildDashboardHomeTakeaway({
            ...baseInput,
            entries: [
                {
                    title: 'Project went well',
                    content: 'I handled the meeting better than expected.',
                    mood: 'happy',
                    createdAt: '2026-05-01T09:00:00.000Z',
                },
            ],
        });

        expect(takeaway.persona).toBe('done_today');
        expect(takeaway.headline).toContain("You've kept enough for today");
        expect(takeaway.primaryAction.kind).toBe('none');
    });

    it('names a repeated mood as the pattern takeaway', () => {
        const takeaway = buildDashboardHomeTakeaway({
            ...baseInput,
            entries: [
                {
                    title: 'Morning',
                    content: 'Started better.',
                    mood: 'happy',
                    createdAt: '2026-04-30T09:00:00.000Z',
                },
                {
                    title: 'Yesterday',
                    content: 'Still good.',
                    mood: 'happy',
                    createdAt: '2026-04-29T09:00:00.000Z',
                },
            ],
        });

        expect(takeaway.persona).toBe('pattern');
        expect(takeaway.headline).toContain('Happy');
        expect(takeaway.signals[0]).toMatchObject({ label: 'Mood thread', value: 'Happy x2' });
    });
});
