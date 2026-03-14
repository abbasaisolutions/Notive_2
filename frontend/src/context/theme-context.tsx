'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

type Theme = 'dark';

interface ThemeContextType {
    theme: Theme;
    toggleTheme: () => void;
    setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setThemeState] = useState<Theme>('dark');

    useEffect(() => {
        // Keep the current release locked to the neutral dark theme.
        setThemeState('dark');
        localStorage.setItem('notive_theme', 'dark');
        document.documentElement.classList.remove('light');
    }, []);

    const setTheme = useCallback((newTheme: Theme) => {
        setThemeState(newTheme || 'dark');
        localStorage.setItem('notive_theme', 'dark');
        document.documentElement.classList.remove('light');
    }, []);

    const toggleTheme = useCallback(() => {
        setTheme('dark');
    }, [setTheme]);

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
