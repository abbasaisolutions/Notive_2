'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useGamification } from '@/context/gamification-context';
import { useAuth } from '@/context/auth-context';
import { usePushNotifications } from '@/context/push-notification-context';
import useAuthRedirect from '@/hooks/use-auth-redirect';
import { hasCompletedOnboardingRequirements } from '@/utils/onboarding';
import { FiBell, FiDownload, FiEdit3, FiLogOut, FiShield } from 'react-icons/fi';
import { Spinner } from '@/components/ui';

function getXPForLevel(level: number) {
    const thresholds = [0, 100, 300, 600, 1000, 1500, 2500, 4000, 6000, 10000, 999999];
    return thresholds[Math.min(level - 1, 10)];
}

function getPinnedSupportSummary(signals: Record<string, unknown> | null | undefined) {
    const supportPreferences = signals?.supportPreferences;
    if (!supportPreferences || typeof supportPreferences !== 'object' || Array.isArray(supportPreferences)) {
        return { peopleCount: 0, routineCount: 0, contactCount: 0, leadName: null as string | null };
    }
    const record = supportPreferences as Record<string, unknown>;
    const pinnedPeople = Array.isArray(record.pinnedPeople) ? record.pinnedPeople.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : [];
    const groundingRoutines = Array.isArray(record.groundingRoutines) ? record.groundingRoutines.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : [];
    const trustedContacts = Array.isArray(record.trustedContacts)
        ? record.trustedContacts.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item) && typeof (item as Record<string, unknown>).name === 'string')
        : [];
    const leadName = (trustedContacts[0] as Record<string, unknown> | undefined)?.name as string | null ?? pinnedPeople[0] ?? null;
    return { peopleCount: pinnedPeople.length, routineCount: groundingRoutines.length, contactCount: trustedContacts.length, leadName };
}

type ProfileTab = 'about' | 'privacy';

export default function ProfileClient() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, isLoading: authLoading, isAuthenticated } = useAuthRedirect();
    const { logout } = useAuth();
    const { stats, refreshStats } = useGamification();
    const { isSupported: pushSupported, isPermissionGranted, requestPermission } = usePushNotifications();
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [isRequestingPush, setIsRequestingPush] = useState(false);

    const tabParam = searchParams.get('tab');
    const activeTab: ProfileTab = tabParam === 'privacy' ? 'privacy' : 'about';

    useEffect(() => {
        refreshStats();
    }, [refreshStats]);

    const handleLogout = async () => {
        setIsLoggingOut(true);
        await logout();
        router.replace('/login');
    };

    const handleRequestPush = async () => {
        setIsRequestingPush(true);
        await requestPermission();
        setIsRequestingPush(false);
    };

    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Spinner size="md" />
            </div>
        );
    }

    if (!isAuthenticated) return null;

    const safeUser = user!;
    const hasCompletedSetup = hasCompletedOnboardingRequirements(safeUser.profile);
    const avatarInitial = safeUser.name?.charAt(0).toUpperCase() || safeUser.email.charAt(0).toUpperCase();
    const avatarUrl = typeof safeUser.avatarUrl === 'string' ? safeUser.avatarUrl.trim() : '';
    const hasAvatar = avatarUrl.length > 0;
    const xpProgress = stats ? ((stats.xp - getXPForLevel(stats.level)) / (getXPForLevel(stats.level + 1) - getXPForLevel(stats.level))) * 100 : 0;
    const highlights = [
        safeUser.profile?.primaryGoal,
        safeUser.profile?.focusArea,
        safeUser.profile?.writingPreference,
        ...(safeUser.profile?.outputGoals || []).slice(0, 2),
    ].filter(Boolean) as string[];
    const support = getPinnedSupportSummary(safeUser.profile?.personalizationSignals);
    const isAdminUser = safeUser.role === 'ADMIN' || safeUser.role === 'SUPERADMIN';

    return (
        <div className="min-h-screen px-4 py-6 md:px-8 md:py-8">
            <div className="mx-auto max-w-3xl space-y-6">
                {/* Header: avatar + name + stats */}
                <section className="workspace-panel rounded-[2rem] p-6 md:p-8">
                    <div className="flex items-center gap-5">
                        <div className="h-20 w-20 rounded-[1.5rem] bg-gradient-to-br from-primary via-accent to-secondary p-1 shrink-0">
                            <div
                                className="flex h-full w-full items-center justify-center overflow-hidden rounded-[1.3rem] text-2xl font-serif"
                                style={{ background: 'rgb(var(--paper-soft))', color: 'rgb(var(--paper-ink))' }}
                            >
                                {hasAvatar ? <img src={avatarUrl} alt={`${safeUser.name || 'User'} avatar`} className="h-full w-full object-cover" /> : avatarInitial}
                            </div>
                        </div>
                        <div className="min-w-0 flex-1">
                            <h1 className="workspace-heading text-2xl font-serif truncate">{safeUser.name || 'Anonymous User'}</h1>
                            <p className="text-sm text-ink-muted truncate">{safeUser.email}</p>
                            {stats && (
                                <div className="mt-2 flex items-center gap-4 text-sm text-ink-secondary">
                                    <span>{stats.totalEntries || 0} entries</span>
                                    <span>{stats.currentStreak || 0} day streak</span>
                                    <span>Lv {stats.level}</span>
                                </div>
                            )}
                        </div>
                        <Link
                            href="/profile/edit?tab=profile"
                            className="notebook-secondary-cta inline-flex h-10 w-10 items-center justify-center rounded-xl transition-colors shrink-0 hover:opacity-80"
                            title="Edit profile"
                        >
                            <FiEdit3 size={18} aria-hidden="true" />
                        </Link>
                    </div>

                    {/* XP bar */}
                    {stats && (
                        <div className="mt-4">
                            <div className="flex items-end justify-between text-xs text-ink-muted">
                                <span>XP</span>
                                <span>{stats.xp} / {getXPForLevel(stats.level + 1)}</span>
                            </div>
                            <div className="mt-1 h-1.5 overflow-hidden rounded-full" style={{ background: 'rgba(var(--paper-border), 0.72)' }}>
                                <div className="h-full rounded-full bg-gradient-to-r from-primary via-accent to-secondary" style={{ width: `${Math.min(xpProgress, 100)}%` }} />
                            </div>
                        </div>
                    )}

                    {/* Tabs */}
                    <div className="workspace-actionbar mt-5 inline-flex gap-1 rounded-2xl p-1">
                        <Link
                            href="/profile"
                            className={`rounded-xl px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition-colors ${activeTab === 'about' ? 'border border-primary/25 bg-primary/15 text-[rgb(var(--text-primary))]' : 'text-ink-secondary hover:text-[rgb(var(--text-primary))]'}`}
                        >
                            About Me
                        </Link>
                        <Link
                            href="/profile?tab=privacy"
                            className={`rounded-xl px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition-colors ${activeTab === 'privacy' ? 'border border-primary/25 bg-primary/15 text-[rgb(var(--text-primary))]' : 'text-ink-secondary hover:text-[rgb(var(--text-primary))]'}`}
                        >
                            Privacy & Data
                        </Link>
                    </div>
                </section>

                {activeTab === 'about' ? (
                    <>
                        {/* Bio + basics */}
                        <section className="workspace-panel rounded-[2rem] p-6">
                            <p className="text-sm leading-7 text-ink-secondary">
                                {safeUser.profile?.bio || 'No bio yet. Tell us a bit about yourself.'}
                            </p>
                            {(safeUser.profile?.location || safeUser.profile?.occupation) && (
                                <div className="mt-4 flex flex-wrap gap-3 text-xs text-ink-muted">
                                    {safeUser.profile?.location && <span>{safeUser.profile.location}</span>}
                                    {safeUser.profile?.location && safeUser.profile?.occupation && <span>·</span>}
                                    {safeUser.profile?.occupation && <span>{safeUser.profile.occupation}</span>}
                                </div>
                            )}
                            {highlights.length > 0 && (
                                <div className="mt-4 flex flex-wrap gap-2">
                                    {highlights.map((item) => (
                                        <span key={item} className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-xs text-primary">
                                            {item}
                                        </span>
                                    ))}
                                </div>
                            )}
                            {!hasCompletedSetup && (
                                <Link
                                    href="/onboarding?returnTo=%2Fprofile"
                                    className="mt-4 inline-flex items-center gap-2 rounded-xl border border-primary/25 bg-primary/12 px-4 py-2 text-sm font-semibold text-[rgb(var(--text-primary))] transition-colors hover:bg-primary/20"
                                >
                                    Finish setup
                                </Link>
                            )}
                        </section>

                        {/* My people */}
                        <section className="workspace-panel rounded-[2rem] p-6">
                            <div className="flex items-center justify-between">
                                <h2 className="workspace-heading text-lg font-semibold">My people</h2>
                                <Link href="/profile/edit?tab=privacy" className="text-xs text-ink-muted transition-colors hover:text-[rgb(var(--text-primary))]">
                                    Edit
                                </Link>
                            </div>
                            {support.contactCount + support.peopleCount > 0 ? (
                                <div className="mt-3 flex flex-wrap gap-2">
                                    <span className="workspace-pill rounded-full px-3 py-1.5 text-xs">
                                        {support.contactCount} contact{support.contactCount === 1 ? '' : 's'}
                                    </span>
                                    <span className="workspace-pill rounded-full px-3 py-1.5 text-xs">
                                        {support.peopleCount} trusted {support.peopleCount === 1 ? 'person' : 'people'}
                                    </span>
                                    <span className="workspace-pill rounded-full px-3 py-1.5 text-xs">
                                        {support.routineCount} routine{support.routineCount === 1 ? '' : 's'}
                                    </span>
                                </div>
                            ) : (
                                <p className="mt-3 text-sm text-ink-secondary">
                                    Add trusted contacts and grounding routines so the app can help when things get heavy.
                                </p>
                            )}
                        </section>

                        {/* Goals */}
                        {(safeUser.profile?.lifeGoals?.length ?? 0) > 0 && (
                            <section className="workspace-panel rounded-[2rem] p-6">
                                <h2 className="workspace-heading text-lg font-semibold">Goals</h2>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {safeUser.profile?.lifeGoals?.map((goal: string) => (
                                        <span key={goal} className="workspace-pill rounded-full px-3 py-1.5 text-xs">
                                            {goal}
                                        </span>
                                    ))}
                                </div>
                            </section>
                        )}
                    </>
                ) : (
                    <>
                        {/* Privacy & Data tab */}
                        <section className="workspace-panel rounded-[2rem] p-6 space-y-3">
                            <h2 className="workspace-heading text-lg font-semibold">Data & Privacy</h2>
                            <div className="grid gap-3">
                                <Link
                                    href="/profile/edit?tab=privacy"
                                    className="workspace-muted-panel flex items-start gap-4 rounded-2xl p-4 transition-colors hover:opacity-90"
                                >
                                    <div className="flex-1">
                                        <p className="workspace-heading text-sm font-semibold">Sharing & Signals</p>
                                        <p className="mt-1 text-sm leading-6 text-ink-secondary">
                                            Manage saved answers, prompt frequency, and support anchors.
                                        </p>
                                    </div>
                                </Link>
                                <Link
                                    href="/profile/edit?tab=privacy"
                                    className="workspace-muted-panel flex items-start gap-4 rounded-2xl p-4 transition-colors hover:opacity-90"
                                >
                                    <FiDownload size={18} className="text-ink-muted mt-0.5 shrink-0" aria-hidden="true" />
                                    <div className="flex-1">
                                        <p className="workspace-heading text-sm font-semibold">Download my data</p>
                                        <p className="mt-1 text-sm leading-6 text-ink-secondary">
                                            Export your entries, signals, and profile as JSON.
                                        </p>
                                    </div>
                                </Link>
                            </div>
                        </section>

                        <section className="workspace-panel rounded-[2rem] p-6 space-y-3">
                            <h2 className="workspace-heading text-lg font-semibold">Notifications</h2>
                            <div className="workspace-muted-panel flex items-start gap-4 rounded-2xl p-4">
                                <FiBell size={18} className="text-ink-muted mt-0.5 shrink-0" aria-hidden="true" />
                                <div className="flex-1 min-w-0">
                                    <p className="workspace-heading text-sm font-semibold">Push Notifications</p>
                                    <p className="mt-1 text-sm leading-6 text-ink-secondary">
                                        {isPermissionGranted
                                            ? 'Enabled — you\'ll get reminders and reflection prompts.'
                                            : 'Get reminders and reflection prompts on your device.'}
                                    </p>
                                    {!isPermissionGranted && pushSupported && (
                                        <button
                                            type="button"
                                            onClick={handleRequestPush}
                                            disabled={isRequestingPush}
                                            className="notebook-secondary-cta mt-3 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors hover:opacity-80 disabled:opacity-60"
                                        >
                                            {isRequestingPush ? <Spinner size="sm" /> : null}
                                            {isRequestingPush ? 'Requesting…' : 'Enable notifications'}
                                        </button>
                                    )}
                                    {isPermissionGranted && (
                                        <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-[rgb(var(--success))]/25 bg-[rgb(var(--success))]/10 px-3 py-1 text-xs font-semibold text-[rgb(var(--success))]">
                                            ✓ Enabled
                                        </span>
                                    )}
                                    {!pushSupported && (
                                        <p className="mt-2 text-xs text-ink-muted">Available in the Notive mobile app.</p>
                                    )}
                                </div>
                            </div>
                        </section>

                        <section className="workspace-panel rounded-[2rem] p-6 space-y-3">
                            <h2 className="workspace-heading text-lg font-semibold">Security & Account</h2>
                            <div className="grid gap-3">
                                <Link
                                    href="/profile/edit?tab=security"
                                    className="workspace-muted-panel flex items-start gap-4 rounded-2xl p-4 transition-colors hover:opacity-90"
                                >
                                    <FiShield size={18} className="text-ink-muted mt-0.5 shrink-0" aria-hidden="true" />
                                    <div className="flex-1">
                                        <p className="workspace-heading text-sm font-semibold">Security & Login</p>
                                        <p className="mt-1 text-sm leading-6 text-ink-secondary">
                                            Change sign-in email, password, or delete your account.
                                        </p>
                                    </div>
                                </Link>
                            </div>
                        </section>

                        {/* Bring in old posts */}
                        <section className="workspace-panel rounded-[2rem] p-6">
                            <h2 className="workspace-heading text-lg font-semibold">Bring in old posts</h2>
                            <p className="mt-2 text-sm text-ink-secondary">
                                Import notes from other apps so Notive can find patterns across everything.
                            </p>
                            <Link
                                href="/import"
                                className="notebook-secondary-cta mt-4 inline-flex rounded-xl px-4 py-2 text-sm font-semibold transition-colors hover:opacity-80"
                            >
                                Manage imports
                            </Link>
                        </section>
                    </>
                )}

                {/* Sign out — always visible */}
                <section className="workspace-panel rounded-[2rem] p-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 text-sm text-ink-secondary">
                            {isAdminUser && (
                                <Link href="/admin" className="text-primary hover:underline">
                                    Admin
                                </Link>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={handleLogout}
                            disabled={isLoggingOut}
                            className="notebook-secondary-cta inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm transition-colors hover:opacity-80 disabled:opacity-60"
                        >
                            <FiLogOut size={16} aria-hidden="true" />
                            {isLoggingOut ? 'Signing out...' : 'Sign out'}
                        </button>
                    </div>
                </section>
            </div>
        </div>
    );
}
