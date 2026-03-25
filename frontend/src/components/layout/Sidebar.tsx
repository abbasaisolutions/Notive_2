'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { useGamification } from '@/context/gamification-context';
import { buildProfileContextSummary } from '@/services/profile-context.service';
import { FiLogOut } from 'react-icons/fi';
import {
    filterNavSectionsByRole,
    getDesktopNavSections,
    getProfileReadinessAction,
    getWorkspaceMaturity,
    isNavItemActive,
    shouldHideGlobalNav,
} from './nav-config';

export default function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const { user, logout } = useAuth();
    const { stats } = useGamification();
    const [isLoggingOut, setIsLoggingOut] = React.useState(false);

    const profileSummary = buildProfileContextSummary(user?.profile ?? null);
    const workspaceMaturity = getWorkspaceMaturity({
        role: user?.role ?? null,
        profile: user?.profile ?? null,
        totalEntries: stats?.totalEntries ?? 0,
    });
    const navSections = filterNavSectionsByRole(getDesktopNavSections(workspaceMaturity), user?.role ?? null);
    const readinessAction = getProfileReadinessAction(profileSummary.completionScore);

    if (shouldHideGlobalNav(pathname)) {
        return null;
    }

    const handleLogout = async () => {
        if (isLoggingOut) return;
        setIsLoggingOut(true);
        try {
            await logout();
            router.replace('/login');
        } finally {
            setIsLoggingOut(false);
        }
    };

    return (
        <aside
            className="hidden md:flex flex-col w-72 glass-nav h-[calc(100vh-2rem)] sticky top-4 left-4 ml-4 my-4 rounded-[2.5rem] overflow-hidden z-50"
            role="complementary"
            aria-label="Workspace navigation"
        >
            <div className="px-7 pt-7 pb-4">
                <Link href="/dashboard" className="inline-block">
                    <h1 className="text-3xl font-serif font-bold bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent tracking-tighter glow-text">
                        Notive.
                    </h1>
                </Link>
                <p className="mt-1 text-xs uppercase tracking-[0.14em] text-ink-muted">
                    {user?.role === 'ADMIN' || user?.role === 'SUPERADMIN'
                        ? 'Admin Workspace'
                        : workspaceMaturity === 'new'
                            ? 'Quiet Start'
                            : workspaceMaturity === 'growing'
                                ? 'Growing Workspace'
                                : 'Growth Workspace'}
                </p>
            </div>

            <nav className="flex-1 px-5 space-y-5 overflow-y-auto pb-4" aria-label="Primary navigation">
                {navSections.map((section) => (
                    <section key={section.id}>
                        <h2 className="pb-2 px-3 text-xs uppercase tracking-[0.18em] text-ink-muted">
                            {section.label}
                        </h2>
                        <div className="space-y-1">
                            {section.items.map((item) => {
                                const isActive = isNavItemActive(pathname, item);
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        aria-current={isActive ? 'page' : undefined}
                                        className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-medium transition-all group ${isActive
                                            ? 'text-white bg-gradient-to-r from-primary/20 to-secondary/15 border border-white/20 shadow-lg shadow-primary/20'
                                            : 'text-ink-secondary hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10'
                                            }`}
                                    >
                                        <span className={`transition-transform duration-300 group-hover:scale-110 ${isActive ? 'text-primary' : 'text-ink-muted'}`}>
                                            {item.icon}
                                        </span>
                                        <span className={isActive ? 'font-semibold tracking-wide' : 'font-normal'}>
                                            {item.label}
                                        </span>
                                    </Link>
                                );
                            })}
                        </div>
                    </section>
                ))}
            </nav>

            {workspaceMaturity !== 'new' && (
                <div className="px-5 pb-4">
                    <div className="rounded-3xl border border-white/10 bg-surface-2/35 p-4">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-xs uppercase tracking-[0.16em] text-ink-muted">Profile Readiness</p>
                            <span className="text-sm font-semibold text-white">{profileSummary.completionScore}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                            <div
                                className="h-full rounded-full bg-gradient-to-r from-primary via-accent to-secondary"
                                style={{ width: `${profileSummary.completionScore}%` }}
                            />
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2">
                                <p className="text-ink-muted uppercase tracking-[0.12em]">Personal</p>
                                <p className="text-white font-semibold">{profileSummary.personalGrowthScore}%</p>
                            </div>
                            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2">
                                <p className="text-ink-muted uppercase tracking-[0.12em]">Professional</p>
                                <p className="text-white font-semibold">{profileSummary.professionalReadinessScore}%</p>
                            </div>
                        </div>
                        <Link
                            href={readinessAction.href}
                            className="mt-3 inline-flex w-full items-center justify-center rounded-xl border border-primary/30 bg-primary/12 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-primary hover:bg-primary/22 transition-colors"
                        >
                            {readinessAction.label}
                        </Link>
                    </div>
                </div>
            )}

            <div className="px-5 pb-6 mt-auto">
                <div className="bg-surface-2/45 backdrop-blur-md p-4 rounded-3xl border border-white/10 group hover:bg-surface-2/70 transition-all">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-sm font-bold text-white shadow-lg animate-float">
                            {(user?.name?.charAt(0) || user?.email?.charAt(0)?.toUpperCase() || 'U')}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-white truncate">{user?.name || 'User'}</div>
                            <div className="text-xs text-ink-muted truncate uppercase tracking-widest">{user?.email}</div>
                        </div>
                    </div>

                    {workspaceMaturity !== 'new' && (
                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2">
                                <p className="text-ink-muted uppercase tracking-[0.12em]">Entries</p>
                                <p className="text-white font-semibold">{stats?.totalEntries ?? 0}</p>
                            </div>
                            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2">
                                <p className="text-ink-muted uppercase tracking-[0.12em]">Streak</p>
                                <p className="text-white font-semibold">{stats?.currentStreak ?? 0} days</p>
                            </div>
                        </div>
                    )}

                    {workspaceMaturity === 'new' && (
                        <p className="mt-3 text-xs leading-6 text-ink-secondary">
                            Keep it simple: Home, Write, Memories, and Me are enough to get started.
                        </p>
                    )}

                    <button
                        onClick={handleLogout}
                        disabled={isLoggingOut}
                        className="w-full mt-3 px-3 py-2 text-xs text-ink-secondary hover:text-white hover:bg-white/5 rounded-xl transition-all flex items-center justify-center gap-2 border border-transparent hover:border-white/10"
                    >
                        <FiLogOut size={14} aria-hidden="true" />
                        {isLoggingOut ? 'Signing Out...' : 'Sign Out'}
                    </button>
                </div>
            </div>
        </aside>
    );
}

