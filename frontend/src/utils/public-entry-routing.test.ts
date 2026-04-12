import { describe, expect, it } from 'vitest';
import {
    isAuthenticatedPublicEntryPath,
    resolveAuthenticatedPublicEntryDestination,
} from '@/utils/public-entry-routing';

describe('isAuthenticatedPublicEntryPath', () => {
    it('matches the native public entry routes', () => {
        expect(isAuthenticatedPublicEntryPath('/')).toBe(true);
        expect(isAuthenticatedPublicEntryPath('/login')).toBe(true);
        expect(isAuthenticatedPublicEntryPath('/register')).toBe(true);
    });

    it('ignores authenticated app routes', () => {
        expect(isAuthenticatedPublicEntryPath('/dashboard')).toBe(false);
        expect(isAuthenticatedPublicEntryPath('/timeline')).toBe(false);
    });
});

describe('resolveAuthenticatedPublicEntryDestination', () => {
    const completeUser = {
        profile: {
            birthDate: '2008-01-01',
            primaryGoal: 'self-growth',
            focusArea: 'clarity',
            starterPrompt: 'What felt important today?',
            experienceLevel: 'beginner',
            writingPreference: 'guided',
            outputGoals: ['self-growth'],
            importPreference: 'later',
            onboardingCompletedAt: '2026-04-12T00:00:00.000Z',
        },
    };

    it('sends returning users on login to the dashboard by default', () => {
        expect(resolveAuthenticatedPublicEntryDestination('/login', '', completeUser)).toBe('/dashboard');
    });

    it('preserves safe returnTo targets from public routes', () => {
        expect(
            resolveAuthenticatedPublicEntryDestination('/register', '?returnTo=%2Ftimeline', completeUser)
        ).toBe('/timeline');
    });

    it('sends incomplete profiles to birth-date collection first', () => {
        expect(
            resolveAuthenticatedPublicEntryDestination('/login', '?returnTo=%2Ftimeline', { profile: {} })
        ).toBe('/profile/complete?returnTo=%2Ftimeline');
    });

    it('sends users with incomplete onboarding through onboarding before their destination', () => {
        expect(
            resolveAuthenticatedPublicEntryDestination('/login', '?returnTo=%2Ftimeline', {
                profile: {
                    birthDate: '2008-01-01',
                },
            })
        ).toBe('/onboarding?returnTo=%2Ftimeline');
    });

    it('ignores non-public routes', () => {
        expect(resolveAuthenticatedPublicEntryDestination('/dashboard', '', completeUser)).toBeNull();
    });
});
