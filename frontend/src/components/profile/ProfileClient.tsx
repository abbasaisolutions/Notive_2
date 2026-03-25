'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useGamification, BADGES } from '@/context/gamification-context';
import { useAuth } from '@/context/auth-context';
import SocialImportPanel from '@/components/import/SocialImportPanel';
import useAuthRedirect from '@/hooks/use-auth-redirect';
import { buildProfileContextSummary } from '@/services/profile-context.service';
import { hasCompletedOnboardingRequirements } from '@/utils/onboarding';
import { FiBell, FiBriefcase, FiEdit3, FiGlobe, FiLogOut, FiShield } from 'react-icons/fi';

function getXPForLevel(level: number) {
    const thresholds = [0, 100, 300, 600, 1000, 1500, 2500, 4000, 6000, 10000, 999999];
    return thresholds[Math.min(level - 1, 10)];
}

function getPinnedSupportPreferences(signals: Record<string, unknown> | null | undefined) {
    const supportPreferences = signals?.supportPreferences;
    if (!supportPreferences || typeof supportPreferences !== 'object' || Array.isArray(supportPreferences)) {
        return {
            pinnedPeople: [] as string[],
            groundingRoutines: [] as string[],
            trustedContacts: [] as Array<{
                id: string;
                name: string;
                relationship?: string;
                channel: 'text' | 'call' | 'in_person';
                note?: string;
                phoneNumber?: string;
                emailAddress?: string;
                isPrimary?: boolean;
            }>,
            safetyRegion: 'auto' as 'auto' | 'us' | 'intl',
        };
    }

    const record = supportPreferences as Record<string, unknown>;
    const pinnedPeople = Array.isArray(record.pinnedPeople)
        ? record.pinnedPeople.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).slice(0, 6)
        : [];
    const groundingRoutines = Array.isArray(record.groundingRoutines)
        ? record.groundingRoutines.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).slice(0, 6)
        : [];
    const trustedContacts = Array.isArray(record.trustedContacts)
        ? record.trustedContacts
            .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
            .map((item, index) => ({
                id: typeof item.id === 'string' && item.id.trim().length > 0 ? item.id : `contact-${index}`,
                name: typeof item.name === 'string' ? item.name.trim() : '',
                relationship: typeof item.relationship === 'string' ? item.relationship.trim() : undefined,
                channel: item.channel === 'call' || item.channel === 'in_person' ? item.channel : 'text',
                note: typeof item.note === 'string' ? item.note.trim() : undefined,
                phoneNumber: typeof item.phoneNumber === 'string' ? item.phoneNumber.trim() : undefined,
                emailAddress: typeof item.emailAddress === 'string' ? item.emailAddress.trim() : undefined,
                isPrimary: Boolean(item.isPrimary),
            }))
            .filter((item) => item.name.length > 0)
            .slice(0, 4)
        : [];
    const safetyRegion = record.safetyRegion === 'us' || record.safetyRegion === 'intl' ? record.safetyRegion : 'auto';

    return {
        pinnedPeople,
        groundingRoutines,
        trustedContacts,
        safetyRegion,
    };
}

export default function ProfileClient() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, isLoading: authLoading, isAuthenticated } = useAuthRedirect();
    const { logout } = useAuth();
    const { stats, refreshStats } = useGamification();
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [showMeDetails, setShowMeDetails] = useState(false);
    const [showSettingsDetails, setShowSettingsDetails] = useState(false);
    const socialImportSectionRef = useRef<HTMLElement | null>(null);
    const panelQuery = searchParams.get('panel');
    const activeView: 'me' | 'settings' = searchParams.get('view') === 'settings' || panelQuery === 'social-import' ? 'settings' : 'me';
    const isSettingsView = activeView === 'settings';

    useEffect(() => {
        refreshStats();
    }, [refreshStats]);

    useEffect(() => {
        if (panelQuery === 'social-import') {
            setShowSettingsDetails(true);
            socialImportSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, [panelQuery]);

    const handleLogout = async () => {
        setIsLoggingOut(true);
        await logout();
        router.replace('/login');
    };

    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
        );
    }

    if (!isAuthenticated) {
        return null;
    }

    const safeUser = user!;
    const earnedBadges = stats?.badges.map((id) => BADGES[id as keyof typeof BADGES]).filter(Boolean) || [];
    const profileSummary = buildProfileContextSummary(safeUser.profile);
    const hasCompletedSetup = hasCompletedOnboardingRequirements(safeUser.profile);
    const isAdminUser = safeUser.role === 'ADMIN' || safeUser.role === 'SUPERADMIN';
    const adminRoleLabel = safeUser.role === 'SUPERADMIN' ? 'Super Admin' : 'Admin';
    const avatarInitial = safeUser.name?.charAt(0).toUpperCase() || safeUser.email.charAt(0).toUpperCase();
    const avatarUrl = typeof safeUser.avatarUrl === 'string' ? safeUser.avatarUrl.trim() : '';
    const hasAvatar = avatarUrl.length > 0;
    const xpProgress = stats ? ((stats.xp - getXPForLevel(stats.level)) / (getXPForLevel(stats.level + 1) - getXPForLevel(stats.level))) * 100 : 0;
    const settingsViewHref = '/profile?view=settings';
    const meViewHref = '/profile';
    const continueSetupHref = hasCompletedSetup ? '/profile/edit?tab=preferences' : '/onboarding?returnTo=%2Fprofile%3Fview%3Dsettings';
    const supportPreferences = getPinnedSupportPreferences(safeUser.profile?.personalizationSignals);
    const supportAnchorCount = supportPreferences.pinnedPeople.length + supportPreferences.groundingRoutines.length + supportPreferences.trustedContacts.length;
    const leadSupportContact = supportPreferences.trustedContacts[0]?.name || supportPreferences.pinnedPeople[0] || null;
    const supportSummary = leadSupportContact
        ? `${leadSupportContact} is ready to help when a note gets heavier than expected.`
        : supportPreferences.groundingRoutines[0]
            ? `Grounding routine saved: ${supportPreferences.groundingRoutines[0]}.`
            : 'Add a trusted contact or one steady routine so Bridge Builder has a safer fallback.';
    const settingsNextAction = hasCompletedSetup
        ? {
            href: '/profile/edit?tab=preferences',
            label: 'Tune prompts',
            description: 'Adjust goals, writing style, and starter prompts without opening every settings panel.',
        }
        : {
            href: continueSetupHref,
            label: 'Finish setup',
            description: 'Complete the basics that shape prompts, imports, and support across the app.',
        };
    const highlights = [
        safeUser.profile?.primaryGoal,
        safeUser.profile?.focusArea,
        safeUser.profile?.writingPreference,
        ...(safeUser.profile?.outputGoals || []).slice(0, 2),
    ].filter(Boolean) as string[];
    const settingsCards = [
        {
            href: '/profile/edit?tab=profile',
            icon: FiEdit3,
            label: 'Identity & Bio',
            description: 'Update your name, bio, location, and profile details.',
        },
        {
            href: continueSetupHref,
            icon: FiBell,
            label: hasCompletedSetup ? 'Prompt Preferences' : 'Finish Setup',
            description: hasCompletedSetup
                ? 'Adjust goals, focus, prompt style, and help settings in one place.'
                : 'Complete the required setup fields that shape the rest of the app.',
        },
        {
            href: '/profile/edit?tab=privacy',
            icon: FiGlobe,
            label: 'Privacy & Data',
            description: 'Export data, review adaptive signals, and manage what the app stores.',
        },
        {
            href: '/profile/edit?tab=security',
            icon: FiShield,
            label: 'Security & Login',
            description: 'Change sign-in email, password, and account access from the secure flow.',
        },
    ];

    return (
        <div className="min-h-screen px-4 py-6 md:px-8 md:py-8">
            <div className="mx-auto max-w-6xl space-y-6">
                <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-6 md:p-8">
                    <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
                        <div className="space-y-4">
                            <span className="inline-flex rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                                {isSettingsView ? 'Settings' : 'Me'}
                            </span>
                            <div>
                                <h1 className="text-3xl font-serif text-white md:text-4xl">
                                    {isSettingsView ? 'Manage account, privacy, and connections.' : 'See your profile, progress, and direction.'}
                                </h1>
                                <p className="mt-3 max-w-2xl text-sm leading-7 text-ink-secondary md:text-base">
                                    {isSettingsView
                                        ? 'Use settings for profile changes, privacy, connected imports, and sign-in security.'
                                        : 'Keep your identity, growth, and personalization in one calmer place without mixing it with every account task.'}
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <span className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-xs text-primary">
                                    Completion {profileSummary.completionScore}%
                                </span>
                                <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white">
                                    {hasCompletedSetup ? 'Setup complete' : 'Setup in progress'}
                                </span>
                                {isAdminUser && (
                                    <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white">
                                        {adminRoleLabel}
                                    </span>
                                )}
                            </div>
                            <div className="inline-flex gap-2 rounded-2xl border border-white/10 bg-black/20 p-1">
                                <Link href={meViewHref} className={`rounded-xl px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] ${!isSettingsView ? 'border border-primary/25 bg-primary/15 text-white' : 'text-ink-secondary hover:text-white'}`}>
                                    Me
                                </Link>
                                <Link href={settingsViewHref} className={`rounded-xl px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] ${isSettingsView ? 'border border-primary/25 bg-primary/15 text-white' : 'text-ink-secondary hover:text-white'}`}>
                                    Settings
                                </Link>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-3">
                            {isSettingsView ? (
                                <>
                                    <Link href="/profile/edit" className="inline-flex items-center gap-3 rounded-[1.2rem] border border-primary/25 bg-primary px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary/90">
                                        <FiEdit3 size={18} aria-hidden="true" />
                                        Open Profile Editor
                                    </Link>
                                    <Link href={meViewHref} className="rounded-[1.2rem] border border-white/12 bg-white/[0.03] px-5 py-3 text-sm font-semibold text-ink-secondary transition-colors hover:bg-white/[0.06] hover:text-white">
                                        Back to Me
                                    </Link>
                                </>
                            ) : (
                                <>
                                    <Link href={settingsViewHref} className="inline-flex items-center gap-3 rounded-[1.2rem] border border-primary/25 bg-primary px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary/90">
                                        <FiEdit3 size={18} aria-hidden="true" />
                                        Open Settings
                                    </Link>
                                    <Link href="/profile/edit" className="rounded-[1.2rem] border border-white/12 bg-white/[0.03] px-5 py-3 text-sm font-semibold text-ink-secondary transition-colors hover:bg-white/[0.06] hover:text-white">
                                        Edit Me
                                    </Link>
                                </>
                            )}
                        </div>
                    </div>
                </section>

                {isSettingsView ? (
                    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
                        <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-6 md:p-8">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">Settings</p>
                            <h2 className="mt-2 text-2xl font-serif text-white">One place for account changes</h2>
                            <p className="mt-2 text-sm leading-7 text-ink-secondary">
                                Update profile details, setup choices, privacy controls, and security without mixing them into your personal dashboard.
                            </p>
                            <div className="mt-6 grid gap-3">
                                {settingsCards.map((card) => {
                                    const CardIcon = card.icon;
                                    return (
                                        <Link key={card.href} href={card.href} className="flex items-start gap-4 rounded-2xl border border-white/10 bg-black/20 p-4 transition-colors hover:border-white/15 hover:bg-black/30">
                                            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-white">
                                                <CardIcon size={18} aria-hidden="true" />
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <p className="text-sm font-semibold text-white">{card.label}</p>
                                                    {!hasCompletedSetup && card.label === 'Finish Setup' && (
                                                        <span className="rounded-full border border-primary/25 bg-primary/10 px-2 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-primary">
                                                            Required
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="mt-1 text-sm leading-6 text-ink-secondary">{card.description}</p>
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>
                        </section>

                        <div className="space-y-6">
                            <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-6">
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">Recommended next move</p>
                                <h2 className="mt-2 text-2xl font-serif text-white">{settingsNextAction.label}</h2>
                                <p className="mt-2 text-sm leading-7 text-ink-secondary">{settingsNextAction.description}</p>
                                <div className="mt-5 flex flex-wrap gap-3">
                                    <Link href={settingsNextAction.href} className="rounded-[1.1rem] border border-primary/25 bg-primary/12 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary/20">
                                        {settingsNextAction.label}
                                    </Link>
                                    <button
                                        type="button"
                                        onClick={() => setShowSettingsDetails((current) => !current)}
                                        className="rounded-[1.1rem] border border-white/12 bg-black/20 px-4 py-2 text-sm font-semibold text-ink-secondary transition-colors hover:bg-black/30 hover:text-white"
                                        aria-expanded={showSettingsDetails}
                                    >
                                        {showSettingsDetails ? 'Hide more settings' : 'Show more settings'}
                                    </button>
                                </div>
                            </section>

                            <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-6">
                                <div className="flex items-center gap-4">
                                    <div className="h-16 w-16 rounded-[1.25rem] bg-gradient-to-br from-primary via-accent to-secondary p-1">
                                        <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-[1.1rem] bg-surface-1 text-xl font-serif text-white">
                                            {hasAvatar ? <img src={avatarUrl} alt={`${safeUser.name || 'User'} avatar`} className="h-full w-full object-cover" /> : avatarInitial}
                                        </div>
                                    </div>
                                    <div className="min-w-0">
                                        <h2 className="text-xl font-serif text-white">{safeUser.name || 'Anonymous User'}</h2>
                                        <p className="truncate text-sm text-ink-muted">{safeUser.email}</p>
                                    </div>
                                </div>
                            </section>

                            {showSettingsDetails && (
                                <>
                                    <section ref={socialImportSectionRef} id="social-import" className="scroll-mt-28">
                                        <SocialImportPanel returnToPath="/profile?view=settings&panel=social-import" />
                                    </section>

                                    {isAdminUser && (
                                        <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-6">
                                            <div className="flex items-start justify-between gap-4">
                                                <div>
                                                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">Admin Access</p>
                                                    <h2 className="mt-2 text-2xl font-serif text-white">{adminRoleLabel} Workspace</h2>
                                                    <p className="mt-2 text-sm leading-7 text-ink-secondary">
                                                        Review user health, troubleshoot onboarding and import blockers, and support moderation from one workspace.
                                                    </p>
                                                </div>
                                                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary">
                                                    <FiShield size={18} aria-hidden="true" />
                                                </div>
                                            </div>
                                            <Link href="/admin" className="mt-5 inline-flex items-center gap-2 rounded-[1.1rem] border border-primary/25 bg-primary/12 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary/20">
                                                <FiShield size={16} aria-hidden="true" />
                                                Open Admin Workspace
                                            </Link>
                                        </section>
                                    )}

                                    <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-6">
                                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">Session</p>
                                        <h2 className="mt-2 text-2xl font-serif text-white">Sign out or switch tasks</h2>
                                        <div className="mt-5 flex flex-wrap gap-3">
                                            <Link href={meViewHref} className="rounded-[1.1rem] border border-white/12 bg-black/20 px-4 py-2 text-sm font-semibold text-ink-secondary transition-colors hover:bg-black/30 hover:text-white">
                                                Back to Me
                                            </Link>
                                            <button type="button" onClick={handleLogout} disabled={isLoggingOut} className="inline-flex items-center gap-2 rounded-[1.1rem] border border-white/12 bg-black/20 px-4 py-2 text-sm font-semibold text-ink-secondary transition-colors hover:bg-black/30 hover:text-white disabled:opacity-60">
                                                <FiLogOut size={16} aria-hidden="true" />
                                                {isLoggingOut ? 'Logging out...' : 'Log Out'}
                                            </button>
                                        </div>
                                    </section>
                                </>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
                        <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-6 md:p-8">
                            <div className="flex flex-col gap-6 md:flex-row md:items-start">
                                <div className="h-28 w-28 rounded-[1.75rem] bg-gradient-to-br from-primary via-accent to-secondary p-1">
                                    <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-[1.55rem] bg-surface-1 text-3xl font-serif text-white">
                                        {hasAvatar ? <img src={avatarUrl} alt={`${safeUser.name || 'User'} avatar`} className="h-full w-full object-cover" /> : avatarInitial}
                                    </div>
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h2 className="text-3xl font-serif text-white">{safeUser.name || 'Anonymous User'}</h2>
                                    <p className="mt-1 text-sm text-ink-muted">{safeUser.email}</p>
                                    <p className="mt-4 max-w-2xl text-sm leading-7 text-ink-secondary">
                                        {safeUser.profile?.bio || 'No bio written yet. Share a bit about yourself.'}
                                    </p>
                                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                            <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Location</p>
                                            <p className="mt-2 text-sm text-white">{safeUser.profile?.location || 'Unknown'}</p>
                                        </div>
                                        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                            <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Occupation</p>
                                            <p className="mt-2 text-sm text-white">{safeUser.profile?.occupation || 'Unspecified'}</p>
                                        </div>
                                    </div>
                                    {highlights.length > 0 && (
                                        <div className="mt-4 flex flex-wrap gap-2">
                                            {highlights.map((item) => (
                                                <span key={item} className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-xs text-primary">
                                                    {item}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {earnedBadges.length > 0 && showMeDetails && (
                                <div className="mt-8 border-t border-white/10 pt-6">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-xl font-serif text-white">Achievements</h3>
                                        <span className="text-xs uppercase tracking-[0.12em] text-ink-muted">{earnedBadges.length} badges</span>
                                    </div>
                                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                        {earnedBadges.map((badge) => badge && (
                                            <div key={badge.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                                <div className="text-white">
                                                    <badge.icon size={24} aria-hidden="true" />
                                                </div>
                                                <p className="mt-3 text-sm font-semibold text-white">{badge.name}</p>
                                                <p className="mt-1 text-xs leading-6 text-ink-secondary">{badge.description}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </section>

                        <div className="space-y-6">
                            {stats && (
                                <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-6">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">Growth</p>
                                            <h2 className="mt-2 text-2xl font-serif text-white">Your writing momentum</h2>
                                        </div>
                                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-lg font-semibold text-primary">
                                            {stats.level}
                                        </div>
                                    </div>
                                    <div className="mt-5">
                                        <div className="flex items-end justify-between text-sm">
                                            <span className="text-ink-secondary">XP progress</span>
                                            <span className="text-white">{stats.xp} / {getXPForLevel(stats.level + 1)}</span>
                                        </div>
                                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                                            <div className="h-full rounded-full bg-gradient-to-r from-primary via-accent to-secondary" style={{ width: `${Math.min(xpProgress, 100)}%` }} />
                                        </div>
                                    </div>
                                    <div className="mt-5 grid grid-cols-2 gap-3">
                                        <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-center">
                                            <p className="text-2xl font-serif text-white">{stats.totalEntries || 0}</p>
                                            <p className="mt-1 text-xs uppercase tracking-[0.12em] text-ink-muted">Entries</p>
                                        </div>
                                        <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-center">
                                            <p className="text-2xl font-serif text-white">{stats.currentStreak || 0}</p>
                                            <p className="mt-1 text-xs uppercase tracking-[0.12em] text-ink-muted">Day streak</p>
                                        </div>
                                    </div>
                                </section>
                            )}

                            <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-6">
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">Support</p>
                                <h2 className="mt-2 text-2xl font-serif text-white">Anchors you chose</h2>
                                <p className="mt-2 text-sm leading-7 text-ink-secondary">
                                    {supportSummary}
                                </p>
                                <div className="mt-4 flex flex-wrap gap-2">
                                    <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white">
                                        {supportPreferences.trustedContacts.length} contact{supportPreferences.trustedContacts.length === 1 ? '' : 's'}
                                    </span>
                                    <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white">
                                        {supportPreferences.groundingRoutines.length} routine{supportPreferences.groundingRoutines.length === 1 ? '' : 's'}
                                    </span>
                                    <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white">
                                        {supportAnchorCount} anchor{supportAnchorCount === 1 ? '' : 's'}
                                    </span>
                                </div>
                                {showMeDetails ? (
                                    supportPreferences.pinnedPeople.length === 0 && supportPreferences.groundingRoutines.length === 0 && supportPreferences.trustedContacts.length === 0 ? (
                                        <div className="mt-5 rounded-2xl border border-dashed border-white/12 bg-black/20 p-4 text-sm leading-7 text-ink-secondary">
                                            Nothing pinned yet. Add a trusted contact, one steadying routine, or a safety preference in Data settings to give Bridge Builder a safer fallback.
                                        </div>
                                    ) : (
                                        <div className="mt-5 space-y-4">
                                            {supportPreferences.trustedContacts.length > 0 && (
                                                <div>
                                                    <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Trusted Contacts</p>
                                                    <div className="mt-3 grid gap-3">
                                                        {supportPreferences.trustedContacts.map((contact) => (
                                                            <div key={contact.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                                                <div className="flex flex-wrap items-center gap-2">
                                                                    {contact.isPrimary && (
                                                                        <span className="rounded-full border border-amber-300/25 bg-amber-200/[0.08] px-3 py-1 text-xs text-white">
                                                                            Primary
                                                                        </span>
                                                                    )}
                                                                    <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-ink-secondary">
                                                                        {contact.channel === 'in_person' ? 'In person' : contact.channel === 'call' ? 'Call' : 'Text'}
                                                                    </span>
                                                                    {contact.relationship && (
                                                                        <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-ink-secondary">
                                                                            {contact.relationship}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <p className="mt-3 text-sm font-semibold text-white">{contact.name}</p>
                                                                {contact.note && (
                                                                    <p className="mt-1 text-sm leading-6 text-ink-secondary">{contact.note}</p>
                                                                )}
                                                                {(contact.phoneNumber || contact.emailAddress) && (
                                                                    <div className="mt-2 flex flex-wrap gap-2">
                                                                        {contact.phoneNumber && (
                                                                            <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-ink-secondary">
                                                                                Text / call ready
                                                                            </span>
                                                                        )}
                                                                        {contact.emailAddress && (
                                                                            <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-ink-secondary">
                                                                                Email ready
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            {supportPreferences.pinnedPeople.length > 0 && (
                                                <div>
                                                    <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Trusted People</p>
                                                    <div className="mt-2 flex flex-wrap gap-2">
                                                        {supportPreferences.pinnedPeople.map((item) => (
                                                            <span key={item} className="rounded-full border border-amber-300/25 bg-amber-200/[0.08] px-3 py-1.5 text-xs text-white">
                                                                {item}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            {supportPreferences.groundingRoutines.length > 0 && (
                                                <div>
                                                    <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Grounding Routines</p>
                                                    <div className="mt-2 flex flex-wrap gap-2">
                                                        {supportPreferences.groundingRoutines.map((item) => (
                                                            <span key={item} className="rounded-full border border-emerald-300/25 bg-emerald-300/[0.08] px-3 py-1.5 text-xs text-white">
                                                                {item}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            <div>
                                                <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Safety Region</p>
                                                <div className="mt-2">
                                                    <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white">
                                                        {supportPreferences.safetyRegion === 'us'
                                                            ? 'United States resources'
                                                            : supportPreferences.safetyRegion === 'intl'
                                                                ? 'Local / international resources'
                                                                : 'Auto detect from profile location'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                ) : (
                                    <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-7 text-ink-secondary">
                                        Keep this section tucked away until you need contact details, routines, or safety region settings.
                                    </div>
                                )}
                                <div className="mt-5 flex flex-wrap gap-3">
                                    <Link href="/profile/edit?tab=privacy" className="rounded-[1.1rem] border border-primary/25 bg-primary/12 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary/20">
                                        Edit Support Setup
                                    </Link>
                                    <Link href="/chat?lens=bridge" className="rounded-[1.1rem] border border-white/12 bg-black/20 px-4 py-2 text-sm font-semibold text-ink-secondary transition-colors hover:bg-black/30 hover:text-white">
                                        Open Bridge Builder
                                    </Link>
                                    <button
                                        type="button"
                                        onClick={() => setShowMeDetails((current) => !current)}
                                        className="rounded-[1.1rem] border border-white/12 bg-black/20 px-4 py-2 text-sm font-semibold text-ink-secondary transition-colors hover:bg-black/30 hover:text-white"
                                        aria-expanded={showMeDetails}
                                    >
                                        {showMeDetails ? 'Hide profile details' : 'Show profile details'}
                                    </button>
                                </div>
                            </section>

                            <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-6">
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">Next step</p>
                                <h2 className="mt-2 text-2xl font-serif text-white">Settings live in their own workspace now</h2>
                                <p className="mt-2 text-sm leading-7 text-ink-secondary">
                                    Open Settings when you want to adjust prompts, privacy, imports, and account access without interrupting your personal snapshot.
                                </p>
                                <div className="mt-5 flex flex-wrap gap-3">
                                    <Link href={settingsViewHref} className="rounded-[1.1rem] border border-primary/25 bg-primary/12 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary/20">
                                        Open Settings
                                    </Link>
                                    <Link href={continueSetupHref} className="rounded-[1.1rem] border border-white/12 bg-black/20 px-4 py-2 text-sm font-semibold text-ink-secondary transition-colors hover:bg-black/30 hover:text-white">
                                        {hasCompletedSetup ? 'Tune prompts' : 'Finish setup'}
                                    </Link>
                                </div>
                                <div className="mt-4 flex flex-wrap gap-2">
                                    <Link href="/portfolio?view=export&pack=resume" className="rounded-full border border-white/12 bg-black/20 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-ink-secondary transition-colors hover:bg-black/30 hover:text-white">
                                        Resume
                                    </Link>
                                    <Link href="/portfolio?view=export&pack=statement" className="rounded-full border border-white/12 bg-black/20 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-ink-secondary transition-colors hover:bg-black/30 hover:text-white">
                                        Statement
                                    </Link>
                                    <Link href="/portfolio?view=interview" className="rounded-full border border-white/12 bg-black/20 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-ink-secondary transition-colors hover:bg-black/30 hover:text-white">
                                        Interview
                                    </Link>
                                </div>
                            </section>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
