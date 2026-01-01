'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import logger from '@/utils/logger';

interface UserProfile {
    bio?: string;
    location?: string;
    occupation?: string;
    website?: string;
    lifeGoals?: string[];
}

interface User {
    id: string;
    email: string;
    name: string | null;
    createdAt: string;
    profile?: UserProfile;
}

interface AuthContextType {
    user: User | null;
    accessToken: string | null;
    isLoading: boolean;
    login: (email: string, password: string) => Promise<void>;
    register: (email: string, password: string, name?: string) => Promise<void>;
    logout: () => Promise<void>;
    refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Try to refresh token on mount
   useEffect(() => {
    const initAuth = async () => {
        try {
            // Try to get refresh token from localStorage (if backend doesn't use cookies)
            const refreshToken = localStorage.getItem('refresh_token');

            // If no token, skip refresh
            if (!refreshToken) {
                setIsLoading(false);
                return;
            }

            const response = await fetch(`${API_URL}/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: refreshToken }), // send token explicitly
            });

            if (response.ok) {
                const data = await response.json();
                setAccessToken(data.accessToken);
                setUser(data.user);

                // Optionally update refresh token if backend sends new one
                if (data.refreshToken) {
                    localStorage.setItem('refresh_token', data.refreshToken);
                }
            } else {
                // Refresh failed → clear tokens
                localStorage.removeItem('refresh_token');
                setAccessToken(null);
                setUser(null);
            }
        } catch (error) {
            logger.error('Failed to refresh token on mount', error);
            setAccessToken(null);
            setUser(null);
        } finally {
            setIsLoading(false);
        }
    };

    initAuth();
}, []);

    const login = async (email: string, password: string) => {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email, password }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Login failed');
        }

        setAccessToken(data.accessToken);
        setUser(data.user);
    };

    const register = async (email: string, password: string, name?: string) => {
        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email, password, name }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Registration failed');
        }

        setAccessToken(data.accessToken);
        setUser(data.user);
    };

    const logout = async () => {
        try {
            await fetch(`${API_URL}/auth/logout`, {
                method: 'POST', // Changed to POST for consistency if backend expects it
                credentials: 'include',
            });
        } catch (error) {
            logger.error('Logout failed', error);
        } finally {
            setAccessToken(null);
            setUser(null);
        }
    };

    const refreshUser = async () => {
        try {
            const response = await fetch(`${API_URL}/user/profile`, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            });
            if (response.ok) {
                const data = await response.json();
                setUser(data.user);
            }
        } catch (error) {
            logger.error('Failed to refresh user profile', error);
        }
    };

    return (
        <AuthContext.Provider value={{ user, accessToken, isLoading, login, register, logout, refreshUser }}>
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
