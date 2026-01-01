'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
    {
        href: '/dashboard',
        label: 'Home',
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
        ),
    },
    {
        href: '/timeline',
        label: 'Journey',
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
            </svg>
        ),
    },
    {
        href: '/entry/new',
        label: 'New',
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" x2="12" y1="5" y2="19" />
                <line x1="5" x2="19" y1="12" y2="12" />
            </svg>
        ),
        isMain: true,
    },
    {
        href: '/insights',
        label: 'Insights',
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                <polyline points="16 7 22 7 22 13" />
            </svg>
        ),
    },
    {
        href: '/chapters',
        label: 'Chapters',
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
            </svg>
        ),
    },
    {
        href: '/chat',
        label: 'Chat',
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
        ),
    },
    {
        href: '/profile',
        label: 'Profile',
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="5" />
                <path d="M20 21a8 8 0 1 0-16 0" />
            </svg>
        ),
    },
];

export default function MobileNav() {
    const pathname = usePathname();

    // Don't show on auth pages or share pages
    if (pathname?.startsWith('/login') || pathname?.startsWith('/register') || pathname?.startsWith('/share')) {
        return null;
    }

    return (
        <nav className="fixed bottom-6 left-6 right-6 z-50 md:hidden">
            <div className="bg-teal-dark/60 backdrop-blur-2xl border border-cream/10 rounded-[2.5rem] px-4 py-3 shadow-2xl flex items-center justify-around relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-t from-secondary/5 to-transparent pointer-events-none" />

                {navItems.map((item) => {
                    const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname?.startsWith(item.href));

                    if (item.isMain) {
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className="flex items-center justify-center w-14 h-14 rounded-full bg-primary text-cream shadow-xl shadow-primary/40 hover:scale-110 active:scale-95 transition-all relative z-10"
                            >
                                {item.icon}
                            </Link>
                        );
                    }

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex flex-col items-center justify-center p-2 rounded-2xl transition-all relative z-10 ${isActive ? 'text-secondary scale-110' : 'text-cream/50 hover:text-cream'
                                }`}
                        >
                            <div className={`${isActive ? 'opacity-100' : 'opacity-70'}`}>
                                {React.cloneElement(item.icon as React.ReactElement, {
                                    size: 20,
                                    strokeWidth: isActive ? 2.5 : 2
                                })}
                            </div>
                            <span className={`text-[10px] mt-1 font-bold uppercase tracking-widest ${isActive ? 'opacity-100' : 'opacity-40'}`}>
                                {item.label}
                            </span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
