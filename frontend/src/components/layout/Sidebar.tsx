'use client';

import React from 'react';
import Link from 'next/link';
import NotiveLogo from '@/components/ui/NotiveLogo';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { useGamification } from '@/context/gamification-context';
import { useTheme } from '@/context/theme-context';
import { FiLogOut } from 'react-icons/fi';
import {
    filterNavSectionsByRole,
    getDesktopNavSections,
    getWorkspaceMaturity,
    isNavItemActive,
    shouldHideGlobalNav,
} from './nav-config';

export default function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const { user, logout } = useAuth();
    const { stats } = useGamification();
    const { theme } = useTheme();
    const [isLoggingOut, setIsLoggingOut] = React.useState(false);
    const isPaper = theme === 'paper';

    const workspaceMaturity = getWorkspaceMaturity({
        role: user?.role ?? null,
        profile: user?.profile ?? null,
        totalEntries: stats?.totalEntries ?? 0,
    });
    const navSections = filterNavSectionsByRole(getDesktopNavSections(workspaceMaturity), user?.role ?? null);

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
            className="hidden lg:flex flex-col w-72 glass-nav h-[calc(100vh-2rem)] sticky top-4 left-4 ml-4 my-4 rounded-[2.5rem] overflow-hidden z-50"
            role="complementary"
            aria-label="Workspace navigation"
        >
            <div className="px-7 pt-7 pb-4">
                <NotiveLogo href="/dashboard" size="sm" variant="horizontal" />
                <p className="type-overline mt-1 text-muted">
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
                        <h2 className="type-overline px-3 pb-2 text-muted">
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
                                        className={`type-label-md group flex items-center gap-3 rounded-2xl border px-3 py-2.5 transition-all ${isActive
                                            ? 'border-primary/25 bg-primary/14 text-strong shadow-lg shadow-primary/15'
                                            : 'border-transparent text-soft hover:border-white/10 hover:bg-white/5 hover:text-strong'
                                            }`}
                                    >
                                        <span className={`transition-transform duration-300 group-hover:scale-110 ${isActive ? 'text-accent' : 'text-muted'}`}>
                                            {item.icon}
                                        </span>
                                        <span className={isActive ? 'font-semibold' : 'font-medium'}>
                                            {item.label}
                                        </span>
                                    </Link>
                                );
                            })}
                        </div>
                    </section>
                ))}
            </nav>

            <div className="px-5 pb-6 mt-auto">
                <div className={`backdrop-blur-md p-4 rounded-3xl border group transition-all ${isPaper ? 'bg-white/[0.04] hover:bg-white/[0.08] border-white/10' : 'bg-surface-2/45 hover:bg-surface-2/70 border-white/10'}`}>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-sm font-bold text-white shadow-lg animate-float">
                            {(user?.name?.charAt(0) || user?.email?.charAt(0)?.toUpperCase() || 'U')}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="type-label-md truncate text-strong">{user?.name || 'User'}</div>
                            <div className="type-micro truncate text-muted">{user?.email}</div>
                        </div>
                    </div>

                    <button
                        onClick={handleLogout}
                        disabled={isLoggingOut}
                        className="type-label-sm mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-transparent px-3 py-2 text-soft transition-all hover:border-white/10 hover:bg-white/5 hover:text-strong"
                    >
                        <FiLogOut size={14} aria-hidden="true" />
                        {isLoggingOut ? 'Signing Out...' : 'Sign Out'}
                    </button>
                </div>
            </div>
        </aside>
    );
}
