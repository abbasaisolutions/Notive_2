import { hasCompletedOnboardingFromProfile } from '@/utils/onboarding';
import { sanitizeReturnTo } from '@/utils/redirect';

type AuthRouteUser = {
    profile?: {
        primaryGoal?: string | null;
        focusArea?: string | null;
        starterPrompt?: string | null;
        experienceLevel?: string | null;
        writingPreference?: string | null;
        outputGoals?: string[] | null;
        importPreference?: string | null;
        onboardingCompletedAt?: string | null;
    } | null;
} | null | undefined;

export function resolvePostAuthDestination(
    user: AuthRouteUser,
    returnTo: string | null | undefined
): string {
    const safeReturnTo = sanitizeReturnTo(returnTo);
    const onboardingComplete = hasCompletedOnboardingFromProfile(user?.profile ?? null);

    if (!onboardingComplete) {
        if (safeReturnTo && !safeReturnTo.startsWith('/onboarding')) {
            return `/onboarding?returnTo=${encodeURIComponent(safeReturnTo)}`;
        }
        return '/onboarding';
    }

    return safeReturnTo || '/dashboard';
}

