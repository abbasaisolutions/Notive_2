'use client';

import React from 'react';
import Link from 'next/link';

type FloatingCaptureProps = {
    writeHref: string;
    voiceHref: string;
};

/**
 * Floating "ink blot" pill — pen + mic doodle icons that breathe/pulse.
 * Fixed bottom-right on mobile (above nav bar), floating on desktop.
 */
export default function FloatingCapture({ writeHref, voiceHref }: FloatingCaptureProps) {
    return (
        <div
            className="app-paper fixed z-40 flex items-center gap-2 rounded-[1.2rem] px-2.5 py-2 shadow-lg lg:hidden"
            style={{
                bottom: 'max(calc(var(--app-bottom-clearance, 0px) + 0.625rem), calc(env(safe-area-inset-bottom, 0px) + 4.25rem))',
                right: '1.25rem',
                backdropFilter: 'blur(12px)',
            }}
        >
            {/* Pen doodle */}
            <Link
                href={writeHref}
                className="group relative flex min-h-12 min-w-12 items-center justify-center rounded-full p-1.5 transition-transform hover:scale-105"
                aria-label="Write a new note"
            >
                <svg
                    viewBox="0 0 28 28"
                    fill="none"
                    className="h-7 w-7 ink-breathe"
                    style={{ color: 'rgb(var(--paper-ink))' }}
                    aria-hidden="true"
                >
                    {/* Pen nib — hand-drawn style */}
                    <path
                        d="M8 22L19 7.5C19.8 6.4 21.2 6.2 22 7C22.8 7.8 22.6 9.2 21.5 10L10 21"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                    <path
                        d="M8 22L6 25L9.5 23"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                    <path
                        d="M17 10L19 12"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                    />
                    {/* Ink drops */}
                    <circle cx="5" cy="25" r="0.8" fill="currentColor" className="ink-drop-1" />
                    <circle cx="7.5" cy="26.5" r="0.5" fill="currentColor" className="ink-drop-2" />
                </svg>
            </Link>

            {/* Subtle divider dot */}
            <span
                className="h-1 w-1 rounded-full"
                style={{ backgroundColor: 'rgba(var(--paper-border), 0.5)' }}
            />

            {/* Mic doodle */}
            <Link
                href={voiceHref}
                className="group relative flex min-h-12 min-w-12 items-center justify-center rounded-full p-1.5 transition-transform hover:scale-105"
                aria-label="Record a voice note"
            >
                <svg
                    viewBox="0 0 28 28"
                    fill="none"
                    className="h-7 w-7 ink-pulse"
                    style={{ color: 'rgb(var(--brand))' }}
                    aria-hidden="true"
                >
                    {/* Mic body — sketchy rounded rect */}
                    <rect
                        x="11"
                        y="5"
                        width="6"
                        height="11"
                        rx="3"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                    />
                    {/* Arc */}
                    <path
                        d="M8 14C8 18.4 10.7 21 14 21C17.3 21 20 18.4 20 14"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                    />
                    {/* Stand */}
                    <path d="M14 21V24.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    <path d="M11 24.5H17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    {/* Sound waves */}
                    <path d="M22 10C23 12 23 15 22 17" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" className="sound-wave-1" />
                    <path d="M24.5 8C26 11.5 26 16 24.5 19" stroke="currentColor" strokeWidth="1" strokeLinecap="round" className="sound-wave-2" />
                </svg>
            </Link>
        </div>
    );
}
