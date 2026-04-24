'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';

type Theme = 'dark' | 'paper';

const defaultTheme: Theme = 'paper';

const PAPER_THEME_PREFIXES = [
    '/dashboard',
    '/entry',
    '/timeline',
    '/portfolio',
    '/profile',
    '/chapters',
    '/import',
    '/onboarding',
    '/insights',
    '/admin',
    '/chat',
] as const;

const DARK_THEME_PREFIXES = [
    '/share',
] as const;

const PAPER_THEME_EXACT_ROUTES = new Set([
    '/',
    '/login',
    '/register',
    '/forgot-password',
    '/reset-password',
    '/privacy',
    '/terms',
    '/account-deletion',
]);

const DARK_THEME_EXACT_ROUTES = new Set<string>([]);

const matchesPrefix = (pathname: string, prefix: string) =>
    pathname === prefix || pathname.startsWith(`${prefix}/`);

const getRouteTheme = (pathname: string | null): Theme => {
    if (!pathname) return defaultTheme;
    if (PAPER_THEME_EXACT_ROUTES.has(pathname)) {
        return 'paper';
    }
    if (PAPER_THEME_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix))) {
        return 'paper';
    }
    if (DARK_THEME_EXACT_ROUTES.has(pathname)) {
        return 'dark';
    }
    if (DARK_THEME_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix))) {
        return 'dark';
    }
    return defaultTheme;
};

const applyTheme = (theme: Theme) => {
    if (typeof document === 'undefined') return;

    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme === 'paper' ? 'light' : 'dark';
    document.documentElement.classList.toggle('light', theme === 'paper');
};

interface ThemeContextType {
    theme: Theme;
    toggleTheme: () => void;
    setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const [theme, setThemeState] = useState<Theme>(() => getRouteTheme(pathname));

    useEffect(() => {
        const nextTheme = getRouteTheme(pathname);
        setThemeState(nextTheme);

        if (typeof window !== 'undefined') {
            localStorage.setItem('notive_theme', nextTheme);
        }

        applyTheme(nextTheme);
    }, [pathname]);

    const setTheme = useCallback((newTheme: Theme) => {
        const nextTheme = newTheme || defaultTheme;
        setThemeState(nextTheme);

        if (typeof window !== 'undefined') {
            localStorage.setItem('notive_theme', nextTheme);
        }

        applyTheme(nextTheme);
    }, []);

    const toggleTheme = useCallback(() => {
        setTheme(theme === 'paper' ? 'dark' : 'paper');
    }, [setTheme, theme]);

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within ThemeProvider');
    }
    return context;
}
