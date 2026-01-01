'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';

export default function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const { user, logout } = useAuth();

    // Don't show on auth pages or share pages
    if (!pathname || pathname.startsWith('/login') || pathname.startsWith('/register') || pathname.startsWith('/share')) {
        return null;
    }

    const handleLogout = async () => {
        await logout();
        router.push('/login');
    };

    const navItems = [
        {
            href: '/dashboard',
            label: 'Home',
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
            )
        },
        {
            href: '/entry/new',
            label: 'New Entry',
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" x2="12" y1="5" y2="19" />
                    <line x1="5" x2="19" y1="12" y2="12" />
                </svg>
            )
        },
        {
            href: '/timeline',
            label: 'Journey',
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                </svg>
            )
        },
        {
            href: '/insights',
            label: 'Insights',
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                    <polyline points="16 7 22 7 22 13" />
                </svg>
            )
        },
        {
            href: '/chapters',
            label: 'Chapters',
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
                </svg>
            )
        },
        {
            href: '/chat',
            label: 'Chat',
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
            )
        },
        {
            href: '/legacy',
            label: 'Legacy',
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
                </svg>
            )
        },
        {
            href: '/profile',
            label: 'Profile',
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="8" r="5" />
                    <path d="M20 21a8 8 0 1 0-16 0" />
                </svg>
            )
        }
    ];

    return (
        <aside className="hidden md:flex flex-col w-64 glass-nav h-[calc(100vh-2rem)] sticky top-4 left-4 ml-4 my-4 rounded-[2.5rem] overflow-hidden z-50">
            <div className="p-6">
                <Link href="/dashboard" className="flex items-center gap-3 group">
                    <Image
                        src="/logos/icon.png"
                        alt="Notive"
                        width={40}
                        height={40}
                        className="group-hover:scale-110 transition-transform"
                    />
                    <h1 className="text-2xl font-serif font-bold bg-gradient-to-r from-secondary via-cream to-primary bg-clip-text text-transparent tracking-tighter glow-text">
                        Notive.
                    </h1>
                </Link>
            </div>

            <nav className="flex-1 px-6 space-y-1">
                {navItems.map((item) => {
                    const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname?.startsWith(item.href));
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-4 px-4 py-3 rounded-2xl text-sm font-medium transition-all group ${isActive
                                ? 'text-cream bg-cream/10 shadow-lg shadow-cream/5'
                                : 'text-cream/60 hover:text-cream hover:bg-cream/5'
                                }`}
                        >
                            <span className={`transition-transform duration-300 group-hover:scale-110 ${isActive ? 'text-secondary' : ''}`}>
                                {item.icon}
                            </span>
                            <span className={isActive ? 'font-semibold tracking-wide' : 'font-normal'}>
                                {item.label}
                            </span>
                        </Link>
                    );
                })}
            </nav>

            <div className="p-6 mt-auto">
                <div className="bg-cream/5 backdrop-blur-md p-4 rounded-3xl border border-cream/5 group hover:bg-cream/10 transition-all">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-sm font-bold text-cream shadow-lg animate-float">
                            {user?.name?.charAt(0) || user?.email?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-cream truncate">{user?.name || 'User'}</div>
                            <div className="text-[10px] text-cream/50 truncate uppercase tracking-widest">{user?.email}</div>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="w-full mt-4 px-3 py-2 text-xs text-cream/60 hover:text-cream hover:bg-cream/5 rounded-xl transition-all flex items-center justify-center gap-2 border border-transparent hover:border-cream/5"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                            <polyline points="16 17 21 12 16 7" />
                            <line x1="21" x2="9" y1="12" y2="12" />
                        </svg>
                        Logout
                    </button>
                </div>
            </div>
        </aside>
    );
}
