'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useGamification } from '@/context/gamification-context';
import { useAuth } from '@/context/auth-context';
import { usePushNotifications } from '@/context/push-notification-context';
import useApi from '@/hooks/use-api';
import useAuthRedirect from '@/hooks/use-auth-redirect';
import { hasCompletedOnboardingRequirements } from '@/utils/onboarding';
import {
    buildProfileHighlights,
    type ProfileHighlightEntry,
} from '@/utils/profile-highlights';
import { openNativeNotificationSettings } from '@/services/native-notification-settings.service';
import {
    FiBell,
    FiDownload,
    FiEdit3,
    FiLogOut,
    FiMessageCircle,
    FiShield,
    FiTarget,
    FiUser,
} from 'react-icons/fi';
import { Spinner } from '@/components/ui';
import { SUPPORT_EMAIL } from '@/config/legal';
import { passthroughImageLoader } from '@/lib/image-loader';

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

const PROFILE_HIGHLIGHT_LIMIT = 60;

const formatMonthLabel = (value: string) => new Date(value).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
});

export default function ProfileClient() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { apiFetch } = useApi();
    const { user, isLoading: authLoading, isAuthenticated } = useAuthRedirect();
    const { logout } = useAuth();
    const { stats, refreshStats } = useGamification();
    const {
        isSupported: pushSupported,
        isPermissionGranted,
        permissionState,
        requestPermission,
    } = usePushNotifications();
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [isRequestingPush, setIsRequestingPush] = useState(false);
    const [avatarFailed, setAvatarFailed] = useState(false);
    const [profileEntries, setProfileEntries] = useState<ProfileHighlightEntry[]>([]);
    const avatarUrl = typeof user?.avatarUrl === 'string' ? user.avatarUrl.trim() : '';

    const tabParam = searchParams.get('tab');
    const activeTab: ProfileTab = tabParam === 'privacy' ? 'privacy' : 'about';

    useEffect(() => {
        refreshStats();
    }, [refreshStats]);

    useEffect(() => {
        setAvatarFailed(false);
    }, [avatarUrl]);

    useEffect(() => {
        if (!isAuthenticated || !user?.id) {
            setProfileEntries([]);
            return;
        }

        const controller = new AbortController();
        let mounted = true;

        void (async () => {
            try {
                const response = await apiFetch(`/entries?limit=${PROFILE_HIGHLIGHT_LIMIT}`, {
                    signal: controller.signal,
                });

                if (!response.ok) {
                    return;
                }

                const data = await response.json().catch(() => null) as {
                    entries?: Array<Record<string, unknown>>;
                } | null;

                if (!mounted || !Array.isArray(data?.entries)) {
                    return;
                }

                const nextEntries = data.entries
                    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object')
                    .map((entry) => ({
                        id: typeof entry.id === 'string' ? entry.id : '',
                        title: typeof entry.title === 'string' ? entry.title : null,
                        content: typeof entry.content === 'string' ? entry.content : '',
                        reflection: typeof entry.reflection === 'string' ? entry.reflection : null,
                        createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : '',
                        coverImage: typeof entry.coverImage === 'string' ? entry.coverImage : null,
                    }))
                    .filter((entry) => entry.id && entry.createdAt && entry.content);

                if (mounted) {
                    setProfileEntries(nextEntries);
                }
            } catch (error) {
                if (!controller.signal.aborted) {
                    console.error('Failed to load profile highlights:', error);
                }
            }
        })();

        return () => {
            mounted = false;
            controller.abort();
        };
    }, [apiFetch, isAuthenticated, user?.id]);
    const profileHighlights = useMemo(
        () => buildProfileHighlights(profileEntries),
        [profileEntries]
    );

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

    const handleOpenNotificationSettings = async () => {
        setIsRequestingPush(true);
        await openNativeNotificationSettings();
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
    const hasAvatar = avatarUrl.length > 0;
    const showAvatarImage = hasAvatar && !avatarFailed;
    const highlights = [
        safeUser.profile?.primaryGoal,
        safeUser.profile?.focusArea,
        safeUser.profile?.writingPreference,
        ...(safeUser.profile?.outputGoals || []).slice(0, 2),
    ].filter(Boolean) as string[];
    const support = getPinnedSupportSummary(safeUser.profile?.personalizationSignals);
    const isAdminUser = safeUser.role === 'ADMIN' || safeUser.role === 'SUPERADMIN';
    const favoriteLine = profileHighlights.favoriteLine?.text ?? 'Your favorite line shows up here once a note gives this profile some texture.';
    const favoriteLineHref = profileHighlights.favoriteLine
        ? `/entry/view?id=${profileHighlights.favoriteLine.entryId}`
        : '/entry/new';
    const favoriteLineCta = profileHighlights.favoriteLine ? 'Open the note' : 'Write your first note';
    const reflectedMonths = profileHighlights.monthsReflected;
    const reflectedMonthsLabel = reflectedMonths > 0
        ? `${reflectedMonths} month${reflectedMonths === 1 ? '' : 's'} reflected`
        : 'Your first month starts with one note';
    const latestEntry = profileEntries[0] ?? null;
    const memberSinceLabel = formatMonthLabel(safeUser.createdAt);

    return (
        <div className="min-h-screen px-4 py-6 md:px-8 md:py-8">
            <div className="mx-auto max-w-3xl space-y-6">
                <section className="workspace-panel rounded-[2rem] p-4 md:p-5">
                    <div className="relative overflow-hidden rounded-[1.6rem] border border-white/12">
                        {profileHighlights.coverImage ? (
                            <Image
                                src={profileHighlights.coverImage}
                                loader={passthroughImageLoader}
                                unoptimized
                                alt="Notebook cover"
                                fill
                                sizes="(max-width: 768px) 100vw, 768px"
                                className="object-cover"
                            />
                        ) : (
                            <div
                                className="absolute inset-0"
                                style={{
                                    background: 'radial-gradient(circle at top left, rgba(234,216,189,0.72), transparent 44%), linear-gradient(135deg, rgba(107,143,113,0.92), rgba(38,34,30,0.94))',
                                }}
                            />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-br from-[rgba(38,34,30,0.28)] via-[rgba(38,34,30,0.56)] to-[rgba(38,34,30,0.82)]" />
                        <div className="relative px-5 py-6 md:px-6 md:py-7">
                            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-white/70">
                                Notebook atmosphere
                            </p>
                            <p className="mt-3 max-w-2xl text-xl font-serif italic leading-8 text-white md:text-2xl md:leading-9">
                                &ldquo;{favoriteLine}&rdquo;
                            </p>
                            <div className="mt-4 flex flex-wrap gap-2 text-xs">
                                <span className="rounded-full border border-white/40 bg-white/20 px-3 py-1.5 font-medium text-white shadow-[0_1px_2px_rgba(0,0,0,0.18)] backdrop-blur-sm">
                                    {reflectedMonthsLabel}
                                </span>
                                {stats && (
                                    <span className="rounded-full border border-white/40 bg-white/20 px-3 py-1.5 font-medium text-white shadow-[0_1px_2px_rgba(0,0,0,0.18)] backdrop-blur-sm">
                                        {stats.totalEntries || 0} saved
                                    </span>
                                )}
                                {latestEntry && (
                                    <span className="rounded-full border border-white/40 bg-white/20 px-3 py-1.5 font-medium text-white shadow-[0_1px_2px_rgba(0,0,0,0.18)] backdrop-blur-sm">
                                        Last note {new Date(latestEntry.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="mt-5 flex items-center gap-5">
                        <div className="h-20 w-20 rounded-[1.5rem] bg-gradient-to-br from-primary via-accent to-secondary p-1 shrink-0">
                            <div
                                className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-[1.3rem] text-2xl font-serif"
                                style={{ background: 'rgb(var(--paper-soft))', color: 'rgb(var(--paper-ink))' }}
                            >
                                {showAvatarImage ? (
                                    <Image
                                        src={avatarUrl}
                                        loader={passthroughImageLoader}
                                        unoptimized
                                        alt={`${safeUser.name || 'User'} avatar`}
                                        fill
                                        sizes="80px"
                                        className="h-full w-full object-cover"
                                        onError={() => setAvatarFailed(true)}
                                    />
                                ) : avatarInitial}
                            </div>
                        </div>
                        <div className="min-w-0 flex-1">
                            <h1 className="workspace-heading text-2xl font-serif truncate">{safeUser.name || 'Anonymous User'}</h1>
                            <p className="text-sm text-ink-muted truncate">{safeUser.email}</p>
                            {stats && (
                                <div className="mt-2 flex items-center gap-4 text-sm text-ink-secondary">
                                    <span>{stats.totalEntries || 0} entries</span>
                                    <span>{stats.currentStreak || 0} day streak</span>
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

                    <div className="workspace-actionbar mt-5 inline-flex gap-1 rounded-2xl p-1">
                        <Link
                            href="/profile"
                            className={`rounded-xl px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition-colors ${activeTab === 'about' ? 'border border-primary/25 bg-primary/15 text-[rgb(var(--text-primary))]' : 'text-ink-secondary hover:text-[rgb(var(--text-primary))]'}`}
                        >
                            Profile
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
                        <section className="grid gap-3 md:grid-cols-[1.15fr_0.85fr]">
                            <div className="workspace-panel rounded-[2rem] p-6">
                                <p className="type-overline text-muted">Favorite line you&rsquo;ve written</p>
                                <p className="mt-4 text-lg font-serif italic leading-8 text-strong">
                                    &ldquo;{favoriteLine}&rdquo;
                                </p>
                                <Link
                                    href={favoriteLineHref}
                                    className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary transition-colors hover:opacity-80"
                                >
                                    {favoriteLineCta}
                                </Link>
                            </div>

                            <div className="workspace-panel rounded-[2rem] p-6">
                                <p className="type-overline text-muted">With Notive</p>
                                <div className="mt-4 grid grid-cols-2 gap-3">
                                    <div className="workspace-muted-panel rounded-2xl p-4">
                                        <p className="text-2xl font-semibold text-strong">{reflectedMonths}</p>
                                        <p className="mt-1 text-xs text-muted">months reflected</p>
                                    </div>
                                    <div className="workspace-muted-panel rounded-2xl p-4">
                                        <p className="text-2xl font-semibold text-strong">{stats?.currentStreak || 0}d</p>
                                        <p className="mt-1 text-xs text-muted">current streak</p>
                                    </div>
                                </div>
                                <p className="mt-4 text-sm leading-6 text-ink-secondary">
                                    Building a notebook since {memberSinceLabel}.
                                </p>
                            </div>
                        </section>

                        <section className="workspace-panel rounded-[2rem] p-6">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <h2 className="workspace-heading text-lg font-semibold">Settings</h2>
                                    <p className="mt-1 text-sm text-ink-secondary">
                                        Jump straight to the section you want to change.
                                    </p>
                                </div>
                                <Link href="/profile/edit" className="text-xs text-ink-muted transition-colors hover:text-[rgb(var(--text-primary))]">
                                    Open all
                                </Link>
                            </div>
                            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                <Link href="/profile/edit?tab=profile" className="workspace-muted-panel flex items-start gap-4 rounded-2xl p-4 transition-colors hover:opacity-90">
                                    <FiUser size={18} className="text-ink-muted mt-0.5 shrink-0" aria-hidden="true" />
                                    <div>
                                        <p className="workspace-heading text-sm font-semibold">Profile</p>
                                        <p className="mt-1 text-sm leading-6 text-ink-secondary">
                                            Photo, name, bio, and personal details.
                                        </p>
                                    </div>
                                </Link>
                                <Link href="/profile/edit?tab=preferences" className="workspace-muted-panel flex items-start gap-4 rounded-2xl p-4 transition-colors hover:opacity-90">
                                    <FiTarget size={18} className="text-ink-muted mt-0.5 shrink-0" aria-hidden="true" />
                                    <div>
                                        <p className="workspace-heading text-sm font-semibold">Goals & Coach</p>
                                        <p className="mt-1 text-sm leading-6 text-ink-secondary">
                                            Goals, writing style, and how Notive guides you.
                                        </p>
                                    </div>
                                </Link>
                                <Link href="/profile/edit?tab=security" className="workspace-muted-panel flex items-start gap-4 rounded-2xl p-4 transition-colors hover:opacity-90">
                                    <FiShield size={18} className="text-ink-muted mt-0.5 shrink-0" aria-hidden="true" />
                                    <div>
                                        <p className="workspace-heading text-sm font-semibold">Sign-in & Security</p>
                                        <p className="mt-1 text-sm leading-6 text-ink-secondary">
                                            Sign-in email, password, and account protection.
                                        </p>
                                    </div>
                                </Link>
                                <Link href="/profile/edit?tab=reminders" className="workspace-muted-panel flex items-start gap-4 rounded-2xl p-4 transition-colors hover:opacity-90">
                                    <FiBell size={18} className="text-ink-muted mt-0.5 shrink-0" aria-hidden="true" />
                                    <div>
                                        <p className="workspace-heading text-sm font-semibold">Reminders</p>
                                        <p className="mt-1 text-sm leading-6 text-ink-secondary">
                                            Daily reflection timing and notification nudges.
                                        </p>
                                    </div>
                                </Link>
                            </div>
                        </section>

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
                            {latestEntry && (
                                <p className="mt-4 text-xs uppercase tracking-[0.12em] text-ink-muted">
                                    Latest note: {latestEntry.title || 'Untitled'} · {new Date(latestEntry.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </p>
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
                        <section className="workspace-panel rounded-[2rem] p-6 space-y-3">
                            <h2 className="workspace-heading text-lg font-semibold">Privacy & Data</h2>
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
                                            ? 'Enabled - you will get reminders, shared-memory activity, and reflection prompts.'
                                            : permissionState === 'denied'
                                                ? 'Notifications are turned off in your device settings. Tap below to re-enable them.'
                                                : 'Get reminders, shared-memory activity, and reflection prompts on your device.'}
                                    </p>
                                    {!isPermissionGranted && pushSupported && permissionState !== 'denied' && (
                                        <button
                                            type="button"
                                            onClick={handleRequestPush}
                                            disabled={isRequestingPush}
                                            className="notebook-secondary-cta mt-3 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors hover:opacity-80 disabled:opacity-60"
                                        >
                                            {isRequestingPush ? <Spinner size="sm" /> : null}
                                            {isRequestingPush ? 'Requesting...' : 'Enable notifications'}
                                        </button>
                                    )}
                                    {!isPermissionGranted && pushSupported && permissionState === 'denied' && (
                                        <>
                                            <button
                                                type="button"
                                                onClick={handleOpenNotificationSettings}
                                                disabled={isRequestingPush}
                                                className="notebook-secondary-cta mt-3 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors hover:opacity-80 disabled:opacity-60"
                                            >
                                                {isRequestingPush ? <Spinner size="sm" /> : null}
                                                {isRequestingPush ? 'Opening...' : 'Open notification settings'}
                                            </button>
                                            <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-700">
                                                Notifications disabled in Android Settings
                                            </span>
                                        </>
                                    )}
                                    {isPermissionGranted && (
                                        <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-[rgb(var(--success))]/25 bg-[rgb(var(--success))]/10 px-3 py-1 text-xs font-semibold text-[rgb(var(--success))]">
                                            ✓ Enabled
                                        </span>
                                    )}
                                    {!pushSupported && (
                                        <p className="mt-2 text-xs text-ink-muted">Available in the Notive mobile app.</p>
                                    )}
                                    <div className="mt-4 flex flex-wrap gap-2">
                                        <Link
                                            href="/notifications"
                                            className="notebook-secondary-cta inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors hover:opacity-80"
                                        >
                                            Open notification center
                                        </Link>
                                        <Link
                                            href="/profile/edit?tab=reminders"
                                            className="workspace-button-outline inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors"
                                        >
                                            Notification schedule
                                        </Link>
                                        {isAdminUser && (
                                            <Link
                                                href="/debug/push"
                                                className="workspace-button-outline inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors"
                                            >
                                                Push debug
                                            </Link>
                                        )}
                                    </div>
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

                <section className="workspace-panel rounded-[2rem] p-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 text-sm text-ink-secondary">
                            <a
                                href={`mailto:${SUPPORT_EMAIL || 'support@notive.com'}?subject=${encodeURIComponent('Notive Feedback')}`}
                                className="inline-flex items-center gap-1.5 text-primary hover:underline"
                            >
                                <FiMessageCircle size={15} aria-hidden="true" />
                                Send Feedback
                            </a>
                            {isAdminUser && (
                                <Link
                                    href="/admin"
                                    className="inline-flex items-center gap-1.5 text-primary hover:underline"
                                >
                                    <FiShield size={15} aria-hidden="true" />
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
