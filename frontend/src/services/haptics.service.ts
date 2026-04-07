/**
 * Haptics service — thin wrapper around navigator.vibrate (Android / Chrome WebView).
 * iOS Chrome / Safari do not support the Vibration API; calls are silently no-ops there.
 * Patterns follow Material Motion haptics guidelines: short = 5ms, medium = 30ms.
 */

function vibrate(pattern: number | number[]): void {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
            navigator.vibrate(pattern);
        } catch {
            // Non-fatal — ignore on platforms that block vibration
        }
    }
}

/** Minimal click confirmation — tap on interactive elements */
export function hapticTap(): void {
    vibrate(5);
}

/** Lighter than tap — for low-emphasis UI changes */
export function hapticLight(): void {
    vibrate(3);
}

/** Success or completion feedback — e.g. entry saved, voice captured */
export function hapticSuccess(): void {
    vibrate(30);
}

/** Error or rejection feedback — e.g. validation failed, offline */
export function hapticError(): void {
    vibrate([20, 40, 20]);
}

/** Warning rhythm — e.g. word count gate nudge */
export function hapticWarning(): void {
    vibrate([10, 50, 10]);
}
