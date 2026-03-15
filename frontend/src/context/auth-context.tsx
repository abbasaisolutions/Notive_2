'use client';

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import logger from '@/utils/logger';
import secureStorage from '@/utils/secure-storage';
import { API_URL } from '@/constants/config';
import { clearOnboardingState } from '@/utils/onboarding';
import type { CredentialSsoProvider } from '@/utils/sso';

interface UserProfile {
    bio?: string;
    location?: string;
    occupation?: string;
    website?: string;
    lifeGoals?: string[];
    primaryGoal?: string | null;
    focusArea?: string | null;
    experienceLevel?: string | null;
    writingPreference?: string | null;
    starterPrompt?: string | null;
    outputGoals?: string[];
    importPreference?: string | null;
    personalizationSignals?: Record<string, unknown> | null;
    onboardingCompletedAt?: string | null;
    updatedAt?: string | null;
}

interface User {
    id: string;
    email: string;
    name: string | null;
    avatarUrl?: string | null;
    hasPassword?: boolean;
    createdAt: string;
    updatedAt?: string;
    role?: string;
    profile?: UserProfile;
}

interface AuthContextType {
    user: User | null;
    accessToken: string | null;
    isLoading: boolean;
    login: (email: string, password: string) => Promise<User>;
    loginWithSsoCredential: (provider: CredentialSsoProvider, credential: string) => Promise<User>;
    loginWithGoogleCredential: (credential: string) => Promise<User>;
    register: (email: string, password: string, name?: string) => Promise<User>;
    logout: () => Promise<void>;
    refreshUser: () => Promise<void>;
    refreshSession: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const REFRESH_TOKEN_KEY = 'notive_refresh_token';
const REFRESH_RETRY_DELAY_MS = 30000;

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

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const refreshInFlightRef = useRef<Promise<string | null> | null>(null);
    const refreshBlockedUntilRef = useRef<number>(0);

    const performRefresh = async (): Promise<string | null> => {
        if (refreshInFlightRef.current) {
            return refreshInFlightRef.current;
        }

        const now = Date.now();
        if (now < refreshBlockedUntilRef.current) {
            return null;
        }

        const refreshPromise = (async (): Promise<string | null> => {
            const isNative = isNativePlatform();
            const storedRefreshToken = isNative ? await secureStorage.get(REFRESH_TOKEN_KEY) : null;

            const headers: Record<string, string> = {};
            let body: string | undefined;

            if (isNative && storedRefreshToken) {
                headers['Content-Type'] = 'application/json';
                headers['x-client-platform'] = 'mobile';
                body = JSON.stringify({ refreshToken: storedRefreshToken });
            }

            const response = await fetch(`${API_URL}/auth/refresh`, {
                method: 'POST',
                credentials: 'include', // Include cookies (web)
                headers,
                body,
            });

            if (!response.ok) {
                if (response.status === 401) {
                    refreshBlockedUntilRef.current = Date.now() + REFRESH_RETRY_DELAY_MS;
                    if (isNative) {
                        await secureStorage.remove(REFRESH_TOKEN_KEY);
                    }
                }
                return null;
            }

            const data = await response.json();
            setAccessToken(data.accessToken);
            setUser(data.user);
            refreshBlockedUntilRef.current = 0;

            if (isNative && data.refreshToken) {
                await secureStorage.set(REFRESH_TOKEN_KEY, data.refreshToken);
            }

            return data.accessToken as string;
        })();

        refreshInFlightRef.current = refreshPromise;
        try {
            return await refreshPromise;
        } finally {
            refreshInFlightRef.current = null;
        }
    };

    // Try to refresh token on mount
    useEffect(() => {
        const initAuth = async () => {
            try {
                await performRefresh();
            } catch (error) {
                logger.error('Failed to refresh token on mount', error);
            } finally {
                setIsLoading(false);
            }
        };

        initAuth();
    }, []);

    const login = async (email: string, password: string): Promise<User> => {
        const isNative = isNativePlatform();
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(isNative ? { 'x-client-platform': 'mobile' } : {}),
            },
            credentials: 'include',
            body: JSON.stringify({ email, password }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Login failed');
        }

        setAccessToken(data.accessToken);
        setUser(data.user);
        refreshBlockedUntilRef.current = 0;

        if (isNative && data.refreshToken) {
            await secureStorage.set(REFRESH_TOKEN_KEY, data.refreshToken);
        }

        return data.user as User;
    };

    const loginWithSsoCredential = async (provider: CredentialSsoProvider, credential: string): Promise<User> => {
        const isNative = isNativePlatform();
        const response = await fetch(`${API_URL}/auth/sso/${provider}/credential`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(isNative ? { 'x-client-platform': 'mobile' } : {}),
            },
            credentials: 'include',
            body: JSON.stringify({ credential }),
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || 'Google sign-in failed');
        }

        setAccessToken(data.accessToken);
        setUser(data.user);
        refreshBlockedUntilRef.current = 0;

        if (isNative && data.refreshToken) {
            await secureStorage.set(REFRESH_TOKEN_KEY, data.refreshToken);
        }

        return data.user as User;
    };

    const loginWithGoogleCredential = async (credential: string): Promise<User> =>
        loginWithSsoCredential('google', credential);

    const register = async (email: string, password: string, name?: string): Promise<User> => {
        const isNative = isNativePlatform();
        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(isNative ? { 'x-client-platform': 'mobile' } : {}),
            },
            credentials: 'include',
            body: JSON.stringify({ email, password, name }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Registration failed');
        }

        setAccessToken(data.accessToken);
        setUser(data.user);
        refreshBlockedUntilRef.current = 0;

        if (isNative && data.refreshToken) {
            await secureStorage.set(REFRESH_TOKEN_KEY, data.refreshToken);
        }

        return data.user as User;
    };

    const logout = async () => {
        try {
            const isNative = isNativePlatform();
            const storedRefreshToken = isNative ? await secureStorage.get(REFRESH_TOKEN_KEY) : null;
            const headers: Record<string, string> = {};
            let body: string | undefined;

            if (isNative && storedRefreshToken) {
                headers['Content-Type'] = 'application/json';
                headers['x-client-platform'] = 'mobile';
                body = JSON.stringify({ refreshToken: storedRefreshToken });
            }

            await fetch(`${API_URL}/auth/logout`, {
                method: 'POST', // Changed to POST for consistency if backend expects it
                credentials: 'include',
                headers,
                body,
            });
        } catch (error) {
            logger.error('Logout failed', error);
        } finally {
            setAccessToken(null);
            setUser(null);
            refreshBlockedUntilRef.current = 0;
            await secureStorage.remove(REFRESH_TOKEN_KEY);
            clearOnboardingState();
        }
    };

    const fetchUserProfile = async (token: string) =>
        fetch(`${API_URL}/user/profile`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
            credentials: 'include',
        });

    const refreshUser = async () => {
        try {
            let token = accessToken;
            if (!token) {
                token = await performRefresh();
            }

            if (!token) {
                return;
            }

            let response = await fetchUserProfile(token);
            if (response.status === 401) {
                const refreshedToken = await performRefresh();
                if (!refreshedToken) {
                    return;
                }
                response = await fetchUserProfile(refreshedToken);
            }

            if (!response.ok) {
                return;
            }

            const data = await response.json();
            setUser(data.user);
        } catch (error) {
            logger.error('Failed to refresh user profile', error);
        }
    };

    return (
        <AuthContext.Provider value={{ user, accessToken, isLoading, login, loginWithSsoCredential, loginWithGoogleCredential, register, logout, refreshUser, refreshSession: performRefresh }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

