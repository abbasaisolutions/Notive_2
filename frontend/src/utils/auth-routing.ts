import { hasCompletedOnboardingFromProfile } from '@/utils/onboarding';
import { unwrapSetupReturnTo } from '@/utils/redirect';

type AuthRouteUser = {
    profile?: {
        birthDate?: string | null;
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

const hasBirthDate = (value: unknown): value is string =>
    typeof value === 'string' && value.trim().length > 0;

export function needsBirthDateCollection(user: AuthRouteUser): boolean {
    return !hasBirthDate(user?.profile?.birthDate);
}

export function buildBirthDateCollectionRedirect(returnTo: string | null | undefined): string {
    const safeReturnTo = unwrapSetupReturnTo(returnTo);

    if (!safeReturnTo) {
        return '/profile/complete';
    }

    return `/profile/complete?returnTo=${encodeURIComponent(safeReturnTo)}`;
}

export function resolvePostAuthDestination(
    user: AuthRouteUser,
    returnTo: string | null | undefined
): string {
    const safeReturnTo = unwrapSetupReturnTo(returnTo);

    if (needsBirthDateCollection(user)) {
        return buildBirthDateCollectionRedirect(safeReturnTo);
    }

    const onboardingComplete = hasCompletedOnboardingFromProfile(user?.profile ?? null);

    if (!onboardingComplete) {
        if (safeReturnTo && !safeReturnTo.startsWith('/onboarding')) {
            return `/onboarding?returnTo=${encodeURIComponent(safeReturnTo)}`;
        }
        return '/onboarding';
    }

    return safeReturnTo || '/dashboard';
}
