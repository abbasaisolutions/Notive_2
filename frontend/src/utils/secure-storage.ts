'use client';

import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { SecureStorage } from '@aparajita/capacitor-secure-storage';

const isNativePlatform = () => {
    if (typeof window === 'undefined') return false;
    if (typeof Capacitor.isNativePlatform === 'function') {
        return Capacitor.isNativePlatform();
    }

    const platform = Capacitor.getPlatform?.();
    return platform === 'ios' || platform === 'android';
};

export const secureStorage = {
    async get(key: string): Promise<string | null> {
        if (!isNativePlatform()) {
            return typeof window !== 'undefined' ? localStorage.getItem(key) : null;
        }

        try {
            return await SecureStorage.getItem(key);
        } catch {
            try {
                const result = await Preferences.get({ key });
                return result?.value ?? null;
            } catch {
                return typeof window !== 'undefined' ? localStorage.getItem(key) : null;
            }
        }
    },

    async set(key: string, value: string): Promise<void> {
        if (!isNativePlatform()) {
            if (typeof window !== 'undefined') localStorage.setItem(key, value);
            return;
        }

        try {
            await SecureStorage.setItem(key, value);
        } catch {
            try {
                await Preferences.set({ key, value });
            } catch {
                if (typeof window !== 'undefined') localStorage.setItem(key, value);
            }
        }
    },

    async remove(key: string): Promise<void> {
        if (!isNativePlatform()) {
            if (typeof window !== 'undefined') localStorage.removeItem(key);
            return;
        }

        try {
            await SecureStorage.removeItem(key);
        } catch {
            try {
                await Preferences.remove({ key });
            } catch {
                if (typeof window !== 'undefined') localStorage.removeItem(key);
            }
        }
    }
};

export default secureStorage;
