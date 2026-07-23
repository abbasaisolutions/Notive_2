/**
 * Canonical motion tokens for framer-motion call sites.
 * Mirrors the CSS custom properties in globals.css (--motion-fast/base/slow
 * and --motion-ease) — the dashboard entrance-animation budget. Keep both
 * in sync, this is the only scale for that policy. (--ease-notive in
 * globals.css is a deliberately separate curve for a few one-off CSS
 * keyframes — not part of this scale.)
 */
export const MOTION_DURATION = {
    fast: 0.15,
    base: 0.24,
    slow: 0.36,
} as const;

export const MOTION_EASE = {
    standard: [0.22, 0.61, 0.36, 1] as const,
};
