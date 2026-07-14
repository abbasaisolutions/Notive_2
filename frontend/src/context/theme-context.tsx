'use client';

import React, { createContext, useContext, useEffect } from 'react';

/**
 * Notive is paper-only. There is no dark theme.
 *
 * A dark theme used to be reachable from a toggle, and the choice persisted in
 * localStorage — which then overrode the per-route theme on every screen. That
 * put `data-theme="dark"` on <html>, which switches form controls to
 * `color-scheme: dark` and made native Android dropdowns and date pickers render
 * white text on the light paper sheet underneath.
 *
 * The type is kept as a single-member union so existing `theme === 'paper'`
 * consumers keep working while the value can never be anything else.
 */
type Theme = 'paper';

const THEME: Theme = 'paper';
const LEGACY_THEME_STORAGE_KEY = 'notive_theme';

const applyTheme = () => {
    if (typeof document === 'undefined') return;

    document.documentElement.dataset.theme = THEME;
    document.documentElement.style.colorScheme = 'light';
    document.documentElement.classList.add('light');
};

interface ThemeContextType {
    theme: Theme;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        // Drop any persisted "dark" choice from the old toggle, otherwise a
        // returning user stays stuck with unreadable form controls.
        if (typeof window !== 'undefined') {
            window.localStorage.removeItem(LEGACY_THEME_STORAGE_KEY);
        }

        applyTheme();
    }, []);

    return (
        <ThemeContext.Provider value={{ theme: THEME }}>
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
