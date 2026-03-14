import { useCallback } from 'react';
import { useAuth } from '@/context/auth-context';
import { API_URL } from '@/constants/config';

type ApiFetchOptions = RequestInit & {
    retryOnUnauthorized?: boolean;
};

export function useApi() {
    const { accessToken, refreshSession, logout } = useAuth();

    const markSessionExpired = () => {
        if (typeof window === 'undefined') return;
        sessionStorage.setItem('notive_auth_reason', 'session-expired');
    };

    const apiFetch = useCallback(async (path: string, options: ApiFetchOptions = {}) => {
        const url = path.startsWith('http')
            ? path
            : `${API_URL}${path.startsWith('/') ? path : `/${path}`}`;

        const headers = new Headers(options.headers || {});

        if (accessToken && !headers.has('Authorization')) {
            headers.set('Authorization', `Bearer ${accessToken}`);
        }

        const response = await fetch(url, {
            ...options,
            headers,
            credentials: options.credentials ?? 'include',
        });

        if (response.status === 401 && options.retryOnUnauthorized !== false) {
            const newToken = await refreshSession();
            if (newToken) {
                const retryHeaders = new Headers(options.headers || {});
                retryHeaders.set('Authorization', `Bearer ${newToken}`);
                return fetch(url, {
                    ...options,
                    headers: retryHeaders,
                    credentials: options.credentials ?? 'include',
                });
            }

            markSessionExpired();
            await logout();
        }

        return response;
    }, [accessToken, refreshSession, logout]);

    return { apiFetch };
}

export default useApi;
