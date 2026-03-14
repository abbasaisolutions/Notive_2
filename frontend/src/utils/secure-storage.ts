'use client';

const isNativePlatform = () => {
    if (typeof window === 'undefined') return false;
    const cap = (window as any).Capacitor;
    if (cap?.isNativePlatform) return cap.isNativePlatform();
    if (cap?.getPlatform) {
        const platform = cap.getPlatform();
        return platform === 'ios' || platform === 'android';
    }
    return false;
};

const getCapacitorPlugin = () => {
    if (typeof window === 'undefined') return null;
    const cap = (window as any).Capacitor;
    if (!cap?.Plugins) return null;
    return cap.Plugins.SecureStoragePlugin || cap.Plugins.Preferences || null;
};

export const secureStorage = {
    async get(key: string): Promise<string | null> {
        if (!isNativePlatform()) {
            return typeof window !== 'undefined' ? localStorage.getItem(key) : null;
        }

        const plugin = getCapacitorPlugin();
        if (!plugin?.get) {
            return typeof window !== 'undefined' ? localStorage.getItem(key) : null;
        }

        const result = await plugin.get({ key });
        return result?.value ?? null;
    },

    async set(key: string, value: string): Promise<void> {
        if (!isNativePlatform()) {
            if (typeof window !== 'undefined') localStorage.setItem(key, value);
            return;
        }

        const plugin = getCapacitorPlugin();
        if (!plugin?.set) {
            if (typeof window !== 'undefined') localStorage.setItem(key, value);
            return;
        }

        await plugin.set({ key, value });
    },

    async remove(key: string): Promise<void> {
        if (!isNativePlatform()) {
            if (typeof window !== 'undefined') localStorage.removeItem(key);
            return;
        }

        const plugin = getCapacitorPlugin();
        if (!plugin?.remove) {
            if (typeof window !== 'undefined') localStorage.removeItem(key);
            return;
        }

        await plugin.remove({ key });
    }
};

export default secureStorage;
