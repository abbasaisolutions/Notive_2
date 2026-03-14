'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useGamification, BADGES } from '@/context/gamification-context';
import { useAuth } from '@/context/auth-context';
import SocialImportPanel from '@/components/import/SocialImportPanel';
import { FadeIn, SlideUp, StaggerContainer } from '@/components/ui/animated-wrappers';
import { motion } from 'framer-motion';
import useAuthRedirect from '@/hooks/use-auth-redirect';
import { buildProfileContextSummary } from '@/services/profile-context.service';
import { hasCompletedOnboardingRequirements } from '@/utils/onboarding';
import {
    FiBell,
    FiBriefcase,
    FiEdit3,
    FiGlobe,
    FiLogOut,
    FiShield,
} from 'react-icons/fi';

function getXPForLevel(level: number) {
    const thresholds = [0, 100, 300, 600, 1000, 1500, 2500, 4000, 6000, 10000, 999999];
    return thresholds[Math.min(level - 1, 10)];
}

export default function ProfileClient() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, isLoading: authLoading, isAuthenticated } = useAuthRedirect();
    const { logout } = useAuth();
    const { stats, refreshStats } = useGamification();
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const socialImportSectionRef = useRef<HTMLElement | null>(null);
    const panelQuery = searchParams.get('panel');

    useEffect(() => {
        refreshStats();
    }, [refreshStats]);

    useEffect(() => {
        if (!panelQuery) return;

        if (panelQuery === 'social-import') {
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
    const xpProgress = stats ? ((stats.xp - getXPForLevel(stats.level)) / (getXPForLevel(stats.level + 1) - getXPForLevel(stats.level))) * 100 : 0;
    const profileGoalMap: Record<string, string> = {
        clarity: 'Mental Clarity',
        memory: 'Memory Keeping',
        growth: 'Personal Growth',
        productivity: 'Execution',
    };
    const profileFocusMap: Record<string, string> = {
        life: 'Personal Life',
        career: 'Career & School',
        both: 'Life + Career',
    };
    const profileWritingMap: Record<string, string> = {
        guided: 'Guided Prompts',
        structured: 'Structured Reflection',
        freeform: 'Freeform Writing',
    };
    const personalizationHighlights = [
        safeUser.profile?.primaryGoal ? profileGoalMap[safeUser.profile.primaryGoal] || safeUser.profile.primaryGoal : null,
        safeUser.profile?.focusArea ? profileFocusMap[safeUser.profile.focusArea] || safeUser.profile.focusArea : null,
        safeUser.profile?.writingPreference ? profileWritingMap[safeUser.profile.writingPreference] || safeUser.profile.writingPreference : null,
    ].filter(Boolean) as string[];
    const outputGoals = safeUser.profile?.outputGoals || [];
    const avatarInitial = safeUser.name?.charAt(0).toUpperCase() || safeUser.email.charAt(0).toUpperCase();
    const avatarUrl = typeof safeUser.avatarUrl === 'string' ? safeUser.avatarUrl.trim() : '';
    const hasAvatar = avatarUrl.length > 0;
    const profileSummary = buildProfileContextSummary(safeUser.profile);
    const hasCompletedSetup = hasCompletedOnboardingRequirements(safeUser.profile);
    const isAdminUser = safeUser.role === 'ADMIN' || safeUser.role === 'SUPERADMIN';
    const adminRoleLabel = safeUser.role === 'SUPERADMIN' ? 'Super Admin' : 'Admin';
    const settingsCards = [
        {
            href: '/profile/edit?tab=profile',
            icon: FiEdit3,
            label: 'Identity & Bio',
            description: 'Update your name, bio, location, and public-facing profile details.',
            accent: 'bg-primary/10 text-primary',
        },
        {
            href: hasCompletedSetup ? '/profile/edit?tab=preferences' : '/onboarding?returnTo=%2Fprofile',
            icon: FiBell,
            label: hasCompletedSetup ? 'Guidance Preferences' : 'Finish Setup',
            description: hasCompletedSetup
                ? 'Adjust goals, focus, prompt style, and product guidance in one place.'
                : 'Complete the required setup fields that shape the rest of the app.',
            accent: 'bg-secondary/10 text-secondary',
        },
        {
            href: '/profile/edit?tab=privacy',
            icon: FiGlobe,
            label: 'Privacy & Data',
            description: 'Export data, review adaptive signals, and manage what the app stores.',
            accent: 'bg-white/[0.03] text-white',
        },
        {
            href: '/profile/edit?tab=security',
            icon: FiShield,
            label: 'Security & Login',
            description: 'Change sign-in email, password, and account access from the secure flow.',
            accent: 'bg-white/[0.03] text-white',
        },
    ];

    return (
        <div className="min-h-screen p-6 md:p-12 relative z-10">
            <FadeIn className="max-w-6xl mx-auto space-y-8 mt-4">

                {/* Header Section */}
                <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-2">
                    <div className="space-y-4">
                        <SlideUp delay={0.1} className="flex items-center gap-3 mb-2">
                            <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs uppercase tracking-[0.2em] font-bold border border-primary/20">
                                Profile & Settings
                            </span>
                        </SlideUp>
                        <SlideUp delay={0.2}>
                            <h1 className="text-4xl md:text-5xl font-serif text-white tracking-tight">Your Account Home.</h1>
                        </SlideUp>
                        <SlideUp delay={0.3}>
                            <p className="zen-text text-lg max-w-lg">Use one clear hub for profile context, connected sources, and the settings studio that controls privacy, security, and personalization.</p>
                        </SlideUp>
                        <SlideUp delay={0.35}>
                            <div className="flex flex-wrap gap-2">
                                <span className="px-3 py-1.5 rounded-xl text-xs border border-primary/30 bg-primary/10 text-primary">
                                    Completion {profileSummary.completionScore}%
                                </span>
                                <span className="px-3 py-1.5 rounded-xl text-xs border border-white/15 bg-white/5 text-white">
                                    Personal {profileSummary.personalGrowthScore}%
                                </span>
                                <span className="px-3 py-1.5 rounded-xl text-xs border border-white/15 bg-white/5 text-white">
                                    Professional {profileSummary.professionalReadinessScore}%
                                </span>
                                {isAdminUser && (
                                    <span className="px-3 py-1.5 rounded-xl text-xs border border-white/15 bg-white/5 text-white">
                                        {adminRoleLabel}
                                    </span>
                                )}
                            </div>
                        </SlideUp>
                    </div>
                    <SlideUp delay={0.4} className="flex items-center gap-3">
                        <Link
                            href="/profile/edit"
                            className="bg-primary hover:bg-primary/90 text-white px-8 py-4 rounded-[1.5rem] font-semibold transition-all shadow-xl shadow-primary/20 inline-flex items-center gap-3"
                        >
                            <FiEdit3 size={20} aria-hidden="true" />
                            Open Settings Studio
                        </Link>
                        <Link
                            href={hasCompletedSetup ? '/profile/edit?tab=privacy' : '/onboarding?returnTo=%2Fprofile'}
                            className="px-5 py-4 rounded-[1.5rem] border border-white/15 bg-white/5 text-ink-secondary hover:text-white hover:bg-white/10 transition-colors text-sm font-semibold"
                        >
                            {hasCompletedSetup ? 'Privacy & Data' : 'Continue Setup'}
                        </Link>
                    </SlideUp>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Left Column - Main Profile Bento */}
                    <StaggerContainer className="lg:col-span-7 xl:col-span-8 space-y-8">
                        {/* Identity Widget */}
                        <SlideUp>
                            <motion.div
                                whileHover={{ scale: 1.01 }}
                                className="bento-box p-10 group relative overflow-hidden transition-all duration-300"
                            >
                                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 blur-[80px] rounded-full -translate-y-1/2 translate-x-1/2 group-hover:bg-primary/20 transition-all duration-700" />

                                <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
                                    <motion.div
                                        whileHover={{ rotate: 5 }}
                                        className="w-32 h-32 rounded-[2rem] bg-gradient-to-br from-primary via-accent to-secondary p-1"
                                    >
                                        <div className="w-full h-full rounded-[1.8rem] bg-surface-1 overflow-hidden flex items-center justify-center text-4xl text-white font-serif">
                                            {hasAvatar ? (
                                                <img
                                                    src={avatarUrl}
                                                    alt={`${safeUser.name || 'User'} avatar`}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : avatarInitial}
                                        </div>
                                    </motion.div>
                                    <div className="text-center md:text-left flex-1">
                                        <h2 className="text-4xl font-serif mb-2">{safeUser.name || 'Anonymous User'}</h2>
                                        <p className="text-ink-muted font-mono text-sm mb-4 tracking-wider">{safeUser.email}</p>
                                        <p className="zen-text text-ink-secondary max-w-md italic">
                                            "{safeUser.profile?.bio || 'No bio written yet. Share a bit about yourself.'}"
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10 pt-8 border-t border-white/5">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-ink-muted">
                                            <FiGlobe size={18} aria-hidden="true" />
                                        </div>
                                        <div>
                                            <p className="text-xs text-ink-muted uppercase tracking-widest font-bold">Location</p>
                                            <p className="text-white text-sm">{safeUser.profile?.location || 'Unknown'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-ink-muted">
                                            <FiBriefcase size={18} aria-hidden="true" />
                                        </div>
                                        <div>
                                            <p className="text-xs text-ink-muted uppercase tracking-widest font-bold">Occupation</p>
                                            <p className="text-white text-sm">{safeUser.profile?.occupation || 'Unspecified'}</p>
                                        </div>
                                    </div>
                                </div>
                                {(personalizationHighlights.length > 0 || outputGoals.length > 0) && (
                                    <div className="mt-6 relative z-10">
                                        <p className="text-xs text-ink-muted uppercase tracking-widest font-bold mb-3">Personalization</p>
                                        <div className="flex flex-wrap gap-2">
                                            {personalizationHighlights.map((item) => (
                                                <span key={item} className="px-3 py-1.5 rounded-xl text-xs border border-primary/30 bg-primary/10 text-primary">
                                                    {item}
                                                </span>
                                            ))}
                                            {outputGoals.slice(0, 3).map((goal) => (
                                                <span key={goal} className="px-3 py-1.5 rounded-xl text-xs border border-white/15 bg-white/5 text-white">
                                                    {goal}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        </SlideUp>

                        {/* Badges Bento */}
                        {earnedBadges.length > 0 && (
                            <SlideUp>
                                <motion.div
                                    whileHover={{ scale: 1.01 }}
                                    className="bento-box p-10 transition-all duration-300"
                                >
                                    <div className="flex items-center justify-between mb-8">
                                        <h3 className="text-2xl font-serif">Achievements</h3>
                                        <span className="text-xs text-ink-muted uppercase tracking-[0.2em] font-bold">
                                            {earnedBadges.length} Badges
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                        {earnedBadges.map((badge) => badge && (
                                            <motion.div
                                                key={badge.id}
                                                whileHover={{ y: -5, backgroundColor: 'rgba(255,255,255,0.1)' }}
                                                className="group p-4 rounded-2xl bg-white/5 border border-white/5 transition-all flex flex-col items-center text-center gap-3"
                                            >
                                                {(() => {
                                                    const BadgeIcon = badge.icon;
                                                    return <BadgeIcon className="text-white group-hover:scale-110 transition-transform duration-500 drop-shadow-lg" size={34} aria-hidden="true" />;
                                                })()}
                                                <div className="space-y-1">
                                                    <p className="text-white text-xs font-bold uppercase tracking-widest">{badge.name}</p>
                                                    <p className="text-xs text-ink-muted line-clamp-1">{badge.description}</p>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                </motion.div>
                            </SlideUp>
                        )}
                    </StaggerContainer>

                    {/* Right Column - Stats & settings */}
                    <StaggerContainer delay={0.2} className="lg:col-span-5 xl:col-span-4 space-y-8">
                        {/* Progression Stats Widget */}
                        {stats && (
                            <SlideUp>
                                <motion.div
                                    whileHover={{ scale: 1.01 }}
                                    className="bento-box p-10 flex flex-col justify-between transition-all duration-300"
                                >
                                    <div className="space-y-8">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-2xl font-serif">Growth</h3>
                                            <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 text-primary text-xl font-bold font-serif">
                                                {stats.level}
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <div className="flex justify-between items-end">
                                                <p className="text-xs text-ink-muted uppercase tracking-widest font-bold">Experience (XP)</p>
                                                <p className="text-sm font-bold text-white tracking-widest">{stats.xp} / {getXPForLevel(stats.level + 1)}</p>
                                            </div>
                                            <div className="h-2 bg-white/5 rounded-full overflow-hidden p-[2px] border border-white/5">
                                                <motion.div
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${Math.min(xpProgress, 100)}%` }}
                                                    transition={{ duration: 1.5, ease: "easeOut" }}
                                                    className="h-full bg-gradient-to-r from-primary via-accent to-secondary rounded-full relative overflow-hidden"
                                                >
                                                    <div className="absolute inset-0 bg-white/20 animate-pulse" />
                                                </motion.div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 pt-4">
                                            <div className="p-4 rounded-2xl bg-white/5 text-center">
                                                <p className="text-2xl font-serif text-white">{stats.totalEntries || 0}</p>
                                                <p className="text-xs text-ink-muted uppercase tracking-widest mt-1">Entries</p>
                                            </div>
                                            <div className="p-4 rounded-2xl bg-white/5 text-center">
                                                <p className="text-2xl font-serif text-white">{stats.currentStreak || 0}</p>
                                                <p className="text-xs text-ink-muted uppercase tracking-widest mt-1">Day Streak</p>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            </SlideUp>
                        )}

                        {/* Social Import Panel */}
                        <SlideUp>
                            <section
                                ref={socialImportSectionRef}
                                id="social-import"
                                className="scroll-mt-28"
                            >
                                <SocialImportPanel returnToPath="/profile?panel=social-import" />
                            </section>
                        </SlideUp>

                        {isAdminUser && (
                            <SlideUp>
                                <motion.div
                                    whileHover={{ scale: 1.01 }}
                                    className="bento-box p-8 space-y-5 transition-all duration-300"
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <p className="text-xs font-bold uppercase tracking-[0.18em] text-ink-muted">Admin Access</p>
                                            <h3 className="mt-2 text-2xl font-serif text-white">{adminRoleLabel} Workspace</h3>
                                            <p className="mt-2 text-sm text-ink-secondary">
                                                Review user health, troubleshoot onboarding and import blockers, and support moderation from one workspace.
                                            </p>
                                        </div>
                                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                                            <FiShield size={20} aria-hidden="true" />
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <span className="rounded-xl border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs text-primary">
                                            Role-safe controls
                                        </span>
                                        <span className="rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white">
                                            User support
                                        </span>
                                        {safeUser.role === 'SUPERADMIN' && (
                                            <span className="rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white">
                                                Elevated permissions
                                            </span>
                                        )}
                                    </div>
                                    <Link
                                        href="/admin"
                                        className="inline-flex items-center gap-3 rounded-[1.25rem] border border-primary/25 bg-primary/10 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary/20"
                                    >
                                        <FiShield size={16} aria-hidden="true" />
                                        Open Admin Workspace
                                    </Link>
                                </motion.div>
                            </SlideUp>
                        )}

                        {/* Quick Settings & Accounts Bento */}
                        <SlideUp>
                            <motion.div
                                id="account-settings"
                                whileHover={{ scale: 1.01 }}
                                className="bento-box p-8 space-y-6 transition-all duration-300"
                            >
                                <div className="px-2">
                                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-ink-muted">Settings Studio</p>
                                    <h3 className="mt-2 text-xl font-serif text-white">One canonical place for account changes</h3>
                                    <p className="mt-2 text-sm text-ink-secondary">
                                        Use the settings studio for profile updates, onboarding preferences, privacy exports, and security-sensitive account actions.
                                    </p>
                                </div>

                                <div className="grid gap-3">
                                    {settingsCards.map((card) => {
                                        const CardIcon = card.icon;
                                        return (
                                            <Link
                                                key={card.href}
                                                href={card.href}
                                                className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition-all hover:bg-white/[0.07]"
                                            >
                                                <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${card.accent}`}>
                                                    <CardIcon size={18} aria-hidden="true" />
                                                </div>
                                                <div className="flex-1 space-y-1">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <p className="text-sm font-semibold text-white">{card.label}</p>
                                                        {!hasCompletedSetup && card.label === 'Finish Setup' && (
                                                            <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">
                                                                Required
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-sm leading-6 text-ink-secondary">{card.description}</p>
                                                </div>
                                            </Link>
                                        );
                                    })}

                                    <motion.button
                                        whileHover={{ x: 5, backgroundColor: 'rgba(100, 116, 139, 0.1)' }}
                                        onClick={handleLogout}
                                        disabled={isLoggingOut}
                                        className="w-full flex items-center justify-between p-4 rounded-2xl hover:bg-white/[0.02] transition-all group mt-4 border border-white/10"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-white/[0.03] text-ink-secondary flex items-center justify-center group-hover:scale-110 transition-transform">
                                                <FiLogOut size={18} aria-hidden="true" />
                                            </div>
                                            <span className="text-sm font-bold text-ink-secondary tracking-wider">Log Out</span>
                                        </div>
                                        {isLoggingOut && <div className="animate-spin h-4 w-4 border-2 border-white/35 border-t-transparent rounded-full" />}
                                    </motion.button>
                                </div>
                            </motion.div>
                        </SlideUp>
                    </StaggerContainer>
                </div>
            </FadeIn>
        </div>
    );
}

