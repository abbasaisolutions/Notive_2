/**
 * Canonical platform detection for native Capacitor app vs. web browser.
 * Import from here instead of duplicating the detection logic.
 */

export type NativePlatform = 'ios' | 'android' | 'web';

export const getNativePlatform = (): NativePlatform => {
    if (typeof window === 'undefined') return 'web';
    const cap = (window as any).Capacitor;
    if (!cap) return 'web';
    if (cap.isNativePlatform && !cap.isNativePlatform()) return 'web';
    if (cap.getPlatform) {
        const platform = cap.getPlatform() as string;
        if (platform === 'ios' || platform === 'android') return platform;
    }
    return 'web';
};

export const isNativePlatform = (): boolean => getNativePlatform() !== 'web';
