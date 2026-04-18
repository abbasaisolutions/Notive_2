'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo, ReactNode } from 'react';
import logger from '@/utils/logger';
import secureStorage from '@/utils/secure-storage';
import { clearOnboardingState } from '@/utils/onboarding';
import type { CredentialSsoProvider } from '@/utils/sso';
import { logoutNativeGoogleSession } from '@/utils/native-google-auth';
import { resolveFriendlyMessage } from '@/utils/friendly-errors';
import { readResponseJson, resolveApiRequestUrl } from '@/lib/api-client';

interface UserProfile {
    bio?: string;
    location?: string;
    occupation?: string;
    website?: string;
    birthDate?: string | null;
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
    register: (email: string, password: string, name?: string, birthDate?: string) => Promise<User>;
    logout: () => Promise<void>;
    refreshUser: () => Promise<void>;
    refreshSession: () => Promise<string | null>;
    syncUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const REFRESH_TOKEN_KEY = 'notive_refresh_token';
const REFRESH_RETRY_DELAY_MS = 30000;
const REFRESH_SERVER_RETRY_DELAY_MS = 10000;

const friendlyAuthMessage = (message: unknown, fallback: string) => {
    const normalized = typeof message === 'string' ? message.trim() : '';

    if (!normalized) return fallback;
    if (/^login failed$/i.test(normalized)) return fallback;
    if (/^google sign-in failed$/i.test(normalized)) return fallback;
    if (/^registration failed$/i.test(normalized)) return fallback;

    return resolveFriendlyMessage(normalized, fallback);
};

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

type SessionPayload = {
    accessToken: string;
    refreshToken?: string;
    user: User;
};

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const refreshInFlightRef = useRef<Promise<string | null> | null>(null);
    const refreshBlockedUntilRef = useRef<number>(0);

    const applySessionPayload = useCallback(async (payload: SessionPayload) => {
        setAccessToken(payload.accessToken);
        setUser(payload.user);
        refreshBlockedUntilRef.current = 0;

        if (isNativePlatform() && payload.refreshToken) {
            await secureStorage.set(REFRESH_TOKEN_KEY, payload.refreshToken);
        }
    }, []);

    const submitSessionRequest = useCallback(async (
        path: string,
        init: RequestInit,
        fallback: string
    ): Promise<User> => {
        const response = await fetch(resolveApiRequestUrl(path), init);
        const data = await readResponseJson<Partial<SessionPayload> & { message?: string }>(response);

        if (!response.ok) {
            throw new Error(friendlyAuthMessage(data?.message, fallback));
        }

        if (typeof data?.accessToken !== 'string' || !data.user) {
            throw new Error(fallback);
        }

        await applySessionPayload(data as SessionPayload);
        return data.user as User;
    }, [applySessionPayload]);

    const performRefresh = useCallback(async (): Promise<string | null> => {
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

            try {
                const response = await fetch(resolveApiRequestUrl('/auth/refresh'), {
                    method: 'POST',
                    credentials: 'include', // Include cookies (web)
                    headers,
                    body,
                });

                if (!response.ok) {
                    refreshBlockedUntilRef.current = Date.now() + (
                        response.status === 401
                            ? REFRESH_RETRY_DELAY_MS
                            : REFRESH_SERVER_RETRY_DELAY_MS
                    );

                    if (response.status === 401 && isNative) {
                        await secureStorage.remove(REFRESH_TOKEN_KEY);
                    }

                    return null;
                }

                const data = await readResponseJson<Partial<SessionPayload>>(response);
                if (typeof data?.accessToken !== 'string' || !data.user) {
                    refreshBlockedUntilRef.current = Date.now() + REFRESH_SERVER_RETRY_DELAY_MS;
                    return null;
                }

                await applySessionPayload(data as SessionPayload);

                return data.accessToken as string;
            } catch (error) {
                refreshBlockedUntilRef.current = Date.now() + REFRESH_SERVER_RETRY_DELAY_MS;
                logger.error('Session refresh request failed', error);
                return null;
            }
        })();

        refreshInFlightRef.current = refreshPromise;
        try {
            return await refreshPromise;
        } finally {
            refreshInFlightRef.current = null;
        }
    }, [applySessionPayload]);

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
    }, [performRefresh]);

    const login = useCallback(async (email: string, password: string): Promise<User> => {
        const fallback = 'We couldn’t sign you in. Check your email and password, then try again.';

        try {
            const isNative = isNativePlatform();
            return await submitSessionRequest('/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(isNative ? { 'x-client-platform': 'mobile' } : {}),
                },
                credentials: 'include',
                body: JSON.stringify({ email, password }),
            }, fallback);
        } catch (error) {
            throw new Error(resolveFriendlyMessage(error, fallback));
        }
    }, [submitSessionRequest]);

    const loginWithSsoCredential = useCallback(async (provider: CredentialSsoProvider, credential: string): Promise<User> => {
        const fallback = provider === 'google'
            ? 'Google sign-in didn’t go through. Please try again.'
            : 'That sign-in method didn’t go through. Please try again.';

        try {
            const isNative = isNativePlatform();
            return await submitSessionRequest(`/auth/sso/${provider}/credential`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(isNative ? { 'x-client-platform': 'mobile' } : {}),
                },
                credentials: 'include',
                body: JSON.stringify({ credential }),
            }, fallback);
        } catch (error) {
            throw new Error(resolveFriendlyMessage(error, fallback));
        }
    }, [submitSessionRequest]);

    const loginWithGoogleCredential = useCallback(async (credential: string): Promise<User> =>
        loginWithSsoCredential('google', credential), [loginWithSsoCredential]);

    const register = useCallback(async (email: string, password: string, name?: string, birthDate?: string): Promise<User> => {
        const fallback = 'We couldn’t create your account just yet. Please try again.';

        try {
            const isNative = isNativePlatform();
            return await submitSessionRequest('/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(isNative ? { 'x-client-platform': 'mobile' } : {}),
                },
                credentials: 'include',
                body: JSON.stringify({ email, password, name, birthDate }),
            }, fallback);
        } catch (error) {
            throw new Error(resolveFriendlyMessage(error, fallback));
        }
    }, [submitSessionRequest]);

    const logout = useCallback(async () => {
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

            await fetch(resolveApiRequestUrl('/auth/logout'), {
                method: 'POST', // Changed to POST for consistency if backend expects it
                credentials: 'include',
                headers,
                body,
            });
            if (isNative) {
                await logoutNativeGoogleSession();
            }
        } catch (error) {
            logger.error('Logout failed', error);
        } finally {
            setAccessToken(null);
            setUser(null);
            refreshBlockedUntilRef.current = 0;
            await secureStorage.remove(REFRESH_TOKEN_KEY);
            clearOnboardingState();
        }
    }, []);

    const fetchUserProfile = useCallback(async (token: string) =>
        fetch(resolveApiRequestUrl('/user/profile'), {
            headers: {
                Authorization: `Bearer ${token}`,
            },
            credentials: 'include',
        }), []);

    const refreshUser = useCallback(async () => {
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
    }, [accessToken, fetchUserProfile, performRefresh]);

    const value = useMemo(() => ({
        user,
        accessToken,
        isLoading,
        login,
        loginWithSsoCredential,
        loginWithGoogleCredential,
        register,
        logout,
        refreshUser,
        refreshSession: performRefresh,
        syncUser: setUser,
    }), [
        accessToken,
        isLoading,
        login,
        loginWithGoogleCredential,
        loginWithSsoCredential,
        logout,
        performRefresh,
        refreshUser,
        register,
        user,
    ]);

    return (
        <AuthContext.Provider value={value}>
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

