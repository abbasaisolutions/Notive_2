'use client';

import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

export type NotebookDoodleName = 'sprout' | 'knot' | 'walker' | 'star' | 'moon' | 'ladder' | 'steady-me' | 'reach-someone' | 'see-my-growth' | 'shape-my-future' | 'pen' | 'mic' | 'quill' | 'compass' | 'hourglass';
export type NotebookAccentName = 'sage' | 'lilac' | 'apricot' | 'sky' | 'amber';

const accentFillClasses: Record<NotebookAccentName, string> = {
    sage: 'fill-[rgba(199,220,203,0.22)]',
    lilac: 'fill-[rgba(216,199,232,0.22)]',
    apricot: 'fill-[rgba(240,205,184,0.24)]',
    sky: 'fill-[rgba(191,214,221,0.24)]',
    amber: 'fill-[rgba(234,216,189,0.24)]',
};

const accentStrokeClasses: Record<NotebookAccentName, string> = {
    sage: 'stroke-[rgba(199,220,203,0.88)]',
    lilac: 'stroke-[rgba(216,199,232,0.9)]',
    apricot: 'stroke-[rgba(240,205,184,0.92)]',
    sky: 'stroke-[rgba(191,214,221,0.92)]',
    amber: 'stroke-[rgba(234,216,189,0.92)]',
};

const accentSolidColors: Record<NotebookAccentName, string> = {
    sage: '#8A9A6F',
    lilac: '#B89FC7',
    apricot: '#D8A48B',
    sky: '#8CAEBB',
    amber: '#C9A86B',
};

function DoodleSvg({
    children,
    className,
    size,
    color,
    viewBox = '0 0 80 80',
}: {
    children: ReactNode;
    className?: string;
    size?: number | string;
    color?: string;
    viewBox?: string;
}) {
    return (
        <svg
            viewBox={viewBox}
            fill="none"
            aria-hidden="true"
            className={cn('h-16 w-16 text-[rgba(141,123,105,0.96)]', className)}
            style={{
                width: size,
                height: size,
                color,
            }}
        >
            {children}
        </svg>
    );
}

export function NotebookDoodle({
    name,
    accent = 'sage',
    className,
    size,
    color,
}: {
    name: NotebookDoodleName;
    accent?: NotebookAccentName;
    className?: string;
    size?: number | string;
    color?: string;
}) {
    const accentFill = accentFillClasses[accent];
    const accentStroke = accentStrokeClasses[accent];
    const accentSolid = accentSolidColors[accent];

    if (name === 'sprout') {
        return (
            <DoodleSvg className={className} size={size} color={color}>
                <ellipse cx="42" cy="36" rx="22" ry="26" className={accentFill} />
                <path d="M40 58V18" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
                <path d="M40 34C31 28 22 28 14 36" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
                <path d="M40 24C48 17 59 17 67 25" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
            </DoodleSvg>
        );
    }

    if (name === 'knot') {
        return (
            <DoodleSvg className={className} size={size} color={color}>
                <path
                    d="M14 42C10 18 30 14 35 28C39 40 28 46 23 48C16 52 18 64 30 64C38 64 46 60 52 52C56 46 62 42 70 42"
                    stroke="currentColor"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                <path d="M60 42C64 42 68 44 72 50" className={accentStroke} strokeWidth="4" strokeLinecap="round" />
            </DoodleSvg>
        );
    }

    if (name === 'walker') {
        return (
            <DoodleSvg className={className} size={size} color={color}>
                <circle cx="44" cy="18" r="8" stroke="currentColor" strokeWidth="3.5" />
                <path d="M44 26V48" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
                <path d="M44 34L28 44" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
                <path d="M44 34L60 28" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
                <path d="M44 48L30 66" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
                <path d="M44 48L58 64" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
                <path d="M14 24C20 18 28 18 34 24" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
            </DoodleSvg>
        );
    }

    if (name === 'star') {
        return (
            <DoodleSvg className={className} size={size} color={color}>
                <path
                    d="M40 12L48 30L68 32L53 45L58 65L40 54L22 65L27 45L12 32L32 30Z"
                    className={accentFill}
                />
                <path
                    d="M40 12L48 30L68 32L53 45L58 65L40 54L22 65L27 45L12 32L32 30Z"
                    stroke="currentColor"
                    strokeWidth="3.3"
                    strokeLinejoin="round"
                />
            </DoodleSvg>
        );
    }

    if (name === 'moon') {
        return (
            <DoodleSvg className={className} size={size} color={color}>
                <path
                    d="M42 16C31 16 22 25 22 38C22 52 33 62 47 62C35 60 28 50 28 39C28 28 35 19 46 17C44.7 16.3 43.4 16 42 16Z"
                    className={accentFill}
                />
                <path d="M40 62C30 64 20 62 12 56" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
                <path
                    d="M24 52C31 57 40 58 48 56C35 54 28 44 28 34C28 25 34 18 44 16C32 14 22 22 22 34C22 41 25 47 30 51"
                    stroke="currentColor"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                <path d="M10 68C28 60 48 60 66 68" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
            </DoodleSvg>
        );
    }

    if (name === 'pen') {
        return (
            <DoodleSvg className={className} size={size} color={color} viewBox="0 0 28 28">
                <path d="M6 22L22 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M8 20L20 8" stroke={accentSolid} strokeWidth="2" strokeLinecap="round" />
                <path d="M4 24L24 24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M10 18L18 10" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
            </DoodleSvg>
        );
    }

    if (name === 'mic') {
        return (
            <DoodleSvg className={className} size={size} color={color} viewBox="0 0 28 28">
                <path d="M14 8C12 8 10 10 10 13V18C10 21 12 23 14 23C16 23 18 21 18 18V13C18 10 16 8 14 8Z" stroke="currentColor" strokeWidth="2" />
                <path d="M14 23V26" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M9 26H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <circle cx="14" cy="13" r="2" fill={accentSolid} />
            </DoodleSvg>
        );
    }

    if (name === 'quill') {
        return (
            <DoodleSvg className={className} size={size} color={color}>
                <path d="M18 64L56 14" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
                <path d="M56 14C62 10 68 12 70 18C66 22 58 24 52 20L56 14Z" className={accentFill} stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
                <path d="M50 24C60 20 66 22 68 28" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                <path d="M44 34C54 30 60 32 62 38" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                <path d="M38 44C48 40 54 42 56 48" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M18 64L14 68" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
                <circle cx="13" cy="69" r="1.5" fill="currentColor" opacity="0.5" />
            </DoodleSvg>
        );
    }

    if (name === 'compass') {
        return (
            <DoodleSvg className={className} size={size} color={color}>
                <circle cx="40" cy="40" r="28" stroke="currentColor" strokeWidth="3" />
                <circle cx="40" cy="40" r="28" className={accentFill} />
                <path d="M40 14V20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M40 60V66" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M14 40H20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M60 40H66" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M40 40L34 24L40 30L46 24Z" fill="currentColor" />
                <path d="M40 40L46 56L40 50L34 56Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" fill="none" />
                <circle cx="40" cy="40" r="3" fill="currentColor" />
            </DoodleSvg>
        );
    }

    if (name === 'hourglass') {
        return (
            <DoodleSvg className={className} size={size} color={color}>
                <path d="M20 14H60" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
                <path d="M20 66H60" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
                <path d="M20 14C24 24 36 36 40 40C44 44 56 56 60 66H20C24 56 36 44 40 40C44 36 56 24 60 14Z" className={accentFill} stroke="currentColor" strokeWidth="2.8" strokeLinejoin="round" />
                <circle cx="40" cy="42" r="1.2" fill="currentColor" opacity="0.55" />
                <circle cx="39" cy="46" r="0.9" fill="currentColor" opacity="0.4" />
                <circle cx="41" cy="50" r="0.7" fill="currentColor" opacity="0.28" />
                <ellipse cx="40" cy="62" rx="12" ry="3" className={accentFill} opacity="0.7" />
            </DoodleSvg>
        );
    }

    // steady-me: ladder with a sprout growing at the top rung
    if (name === 'steady-me') {
        return (
            <DoodleSvg className={className} size={size} color={color}>
                {/* Ladder rails */}
                <path d="M26 62V22" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
                <path d="M54 62V22" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
                {/* Rungs */}
                <path d="M26 50H54" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
                <path d="M26 38H54" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
                <path d="M26 26H54" className={accentStroke} strokeWidth="4" strokeLinecap="round" />
                {/* Sprout at top rung */}
                <path d="M40 26V14" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                <path d="M40 20C36 16 30 16 26 20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M40 17C44 13 50 13 54 17" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </DoodleSvg>
        );
    }

    // reach-someone: two paper hands connecting across a gap, sprout at meeting point
    if (name === 'reach-someone') {
        return (
            <DoodleSvg className={className} size={size} color={color}>
                <ellipse cx="40" cy="50" rx="26" ry="12" className={accentFill} />
                {/* Left hand / arm reaching right */}
                <path d="M10 46C14 42 20 42 26 44C30 46 32 48 34 48" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
                {/* Right hand / arm reaching left */}
                <path d="M70 46C66 42 60 42 54 44C50 46 48 48 46 48" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
                {/* Sprout growing exactly where they meet */}
                <path d="M40 48V30" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                <path d="M40 38C36 33 30 33 27 37" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M40 32C44 27 50 27 53 31" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </DoodleSvg>
        );
    }

    // see-my-growth: tangled knot that unravels into a straight path ending in a folded star
    if (name === 'see-my-growth') {
        return (
            <DoodleSvg className={className} size={size} color={color}>
                {/* Tangled start on left */}
                <path d="M12 50C10 34 24 28 28 38C31 46 22 52 20 56C18 62 26 66 32 62" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
                {/* Smooth unravelling path to star */}
                <path d="M32 62C38 60 44 54 52 48C58 44 64 42 68 44" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
                {/* Tiny folded star at end */}
                <path d="M68 44L70 38L72 44L78 44L73 48L75 54L70 50L65 54L67 48L62 44Z" className={accentFill} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            </DoodleSvg>
        );
    }

    // shape-my-future: open notebook page, a star above it, three evidence lines
    if (name === 'shape-my-future') {
        return (
            <DoodleSvg className={className} size={size} color={color}>
                {/* Notebook page outline */}
                <rect x="14" y="32" width="52" height="38" rx="3" className={accentFill} stroke="currentColor" strokeWidth="3.5" strokeLinejoin="round" />
                {/* Three pencil evidence lines */}
                <line x1="22" y1="46" x2="58" y2="46" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="22" y1="55" x2="52" y2="55" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="22" y1="63" x2="44" y2="63" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                {/* Folded-paper star shining above */}
                <path d="M40 8L43 16L52 17L46 23L48 32L40 27L32 32L34 23L28 17L37 16Z" className={accentFill} stroke="currentColor" strokeWidth="2.8" strokeLinejoin="round" />
            </DoodleSvg>
        );
    }

    // default: ladder
    return (
        <DoodleSvg className={className} size={size} color={color}>
            <path d="M26 62V16" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
            <path d="M54 62V16" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
            <path d="M26 50H54" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
            <path d="M26 38H54" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
            <path d="M26 26H54" className={accentStroke} strokeWidth="5" strokeLinecap="round" />
        </DoodleSvg>
    );
}

// ---------------------------------------------------------------------------
// Extended doodles — quill, compass, hourglass
// ---------------------------------------------------------------------------

function QuillDoodle({ className, size, accentFill, accentStroke: _accentStroke, color }: {
    className?: string; size?: number | string; accentFill: string; accentStroke: string; color?: string;
}) {
    return (
        <DoodleSvg className={className} size={size} color={color}>
            {/* Feather shaft — long diagonal */}
            <path d="M18 64L56 14" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
            {/* Feather barbs — right side */}
            <path d="M56 14C62 10 68 12 70 18C66 22 58 24 52 20L56 14Z" className={accentFill} stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
            <path d="M50 24C60 20 66 22 68 28" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <path d="M44 34C54 30 60 32 62 38" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <path d="M38 44C48 40 54 42 56 48" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            {/* Nib tip and ink drop */}
            <path d="M18 64L14 68" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
            <circle cx="13" cy="69" r="1.5" fill="currentColor" opacity="0.5" />
        </DoodleSvg>
    );
}

function CompassDoodle({ className, size, accentFill, accentStroke: _accentStroke, color }: {
    className?: string; size?: number | string; accentFill: string; accentStroke: string; color?: string;
}) {
    return (
        <DoodleSvg className={className} size={size} color={color}>
            {/* Outer circle */}
            <circle cx="40" cy="40" r="28" stroke="currentColor" strokeWidth="3" />
            {/* Inner fill */}
            <circle cx="40" cy="40" r="28" className={accentFill} />
            {/* N/S/E/W tick marks */}
            <path d="M40 14V20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M40 60V66" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M14 40H20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M60 40H66" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            {/* North needle — solid */}
            <path d="M40 40L34 24L40 30L46 24Z" fill="currentColor" />
            {/* South needle — outline */}
            <path d="M40 40L46 56L40 50L34 56Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" fill="none" />
            {/* Center dot */}
            <circle cx="40" cy="40" r="3" fill="currentColor" />
        </DoodleSvg>
    );
}

function HourglassDoodle({ className, size, accentFill, accentStroke: _accentStroke, color }: {
    className?: string; size?: number | string; accentFill: string; accentStroke: string; color?: string;
}) {
    return (
        <DoodleSvg className={className} size={size} color={color}>
            {/* Top and bottom caps */}
            <path d="M20 14H60" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
            <path d="M20 66H60" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
            {/* Hourglass silhouette */}
            <path d="M20 14C24 24 36 36 40 40C44 44 56 56 60 66H20C24 56 36 44 40 40C44 36 56 24 60 14Z" className={accentFill} stroke="currentColor" strokeWidth="2.8" strokeLinejoin="round" />
            {/* Sand falling — a few dots near the neck */}
            <circle cx="40" cy="42" r="1.2" fill="currentColor" opacity="0.55" />
            <circle cx="39" cy="46" r="0.9" fill="currentColor" opacity="0.4" />
            <circle cx="41" cy="50" r="0.7" fill="currentColor" opacity="0.28" />
            {/* Bottom sand pool */}
            <ellipse cx="40" cy="62" rx="12" ry="3" className={accentFill} opacity="0.7" />
        </DoodleSvg>
    );
}

export function NotebookDoodleExtended({
    name,
    accent = 'sage',
    className,
    size,
    color,
}: {
    name: 'quill' | 'compass' | 'hourglass';
    accent?: NotebookAccentName;
    className?: string;
    size?: number | string;
    color?: string;
}) {
    const accentFill = accentFillClasses[accent];
    const accentStroke = accentStrokeClasses[accent];
    if (name === 'quill') return <QuillDoodle className={className} size={size} color={color} accentFill={accentFill} accentStroke={accentStroke} />;
    if (name === 'compass') return <CompassDoodle className={className} size={size} color={color} accentFill={accentFill} accentStroke={accentStroke} />;
    return <HourglassDoodle className={className} size={size} color={color} accentFill={accentFill} accentStroke={accentStroke} />;
}

export const NotebookDoodles = NotebookDoodle;
