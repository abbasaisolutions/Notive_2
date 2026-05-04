'use client';

import { FiMoon, FiSun } from 'react-icons/fi';
import { useTheme } from '@/context/theme-context';

type ThemeMoodToggleProps = {
    compact?: boolean;
};

export default function ThemeMoodToggle({ compact = false }: ThemeMoodToggleProps) {
    const { theme, setTheme } = useTheme();
    const isNatural = theme === 'paper';
    const nextTheme = isNatural ? 'dark' : 'paper';
    const Icon = isNatural ? FiSun : FiMoon;

    return (
        <button
            type="button"
            onClick={() => setTheme(nextTheme)}
            aria-label={`Switch to ${isNatural ? 'dark' : 'natural'} mood`}
            title={`Switch to ${isNatural ? 'Dark' : 'Natural'} mood`}
            className={`group inline-flex h-10 items-center justify-between gap-2 rounded-full border border-[rgba(var(--paper-border),0.24)] bg-[rgba(255,255,255,0.46)] px-2.5 text-left shadow-sm backdrop-blur transition-colors hover:bg-white/70 ${
                compact ? 'w-full' : ''
            }`}
        >
            <span className="flex min-w-0 items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--paper-sage))] text-white shadow-sm">
                    <Icon size={14} aria-hidden="true" />
                </span>
                <span className="min-w-0">
                    <span className="block text-xs font-semibold leading-4 text-strong">
                        {isNatural ? 'Natural' : 'Dark'}
                    </span>
                    <span className="block text-[0.66rem] leading-3 text-muted">
                        Tap for {isNatural ? 'Dark' : 'Natural'}
                    </span>
                </span>
            </span>
            <span className="h-2 w-2 shrink-0 rounded-full bg-[rgb(var(--paper-sage))] opacity-60 transition-opacity group-hover:opacity-100" />
        </button>
    );
}
