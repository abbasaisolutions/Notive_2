import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './auth-context';

type TestUser = {
    id: string;
    email: string;
    name: string | null;
    createdAt: string;
    updatedAt?: string;
};

const baseUser: TestUser = {
    id: 'user-1',
    email: 'ada@example.com',
    name: 'Ada Lovelace',
    createdAt: '2026-04-15T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
};

const jsonResponse = (body: unknown, status = 200) => new Response(
    JSON.stringify(body),
    {
        status,
        headers: { 'Content-Type': 'application/json' },
    }
);

function AuthProbe() {
    const { user, accessToken, isLoading, refreshUser } = useAuth();

    return (
        <div>
            <p data-testid="loading">{String(isLoading)}</p>
            <p data-testid="token">{accessToken || ''}</p>
            <p data-testid="user-email">{user?.email || ''}</p>
            <p data-testid="user-name">{user?.name || ''}</p>
            <button type="button" onClick={() => void refreshUser()}>
                Refresh user
            </button>
        </div>
    );
}

describe('AuthProvider', () => {
    beforeEach(() => {
        if (typeof window !== 'undefined' && window.localStorage && typeof window.localStorage.clear === 'function') {
            window.localStorage.clear();
        }
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('hydrates the session from refresh on mount', async () => {
        const fetchMock = vi.fn().mockResolvedValueOnce(
            jsonResponse({ accessToken: 'token-1', user: baseUser })
        );
        vi.stubGlobal('fetch', fetchMock);

        render(
            <AuthProvider>
                <AuthProbe />
            </AuthProvider>
        );

        await waitFor(() => {
            expect(screen.getByTestId('loading')).toHaveTextContent('false');
        });

        expect(screen.getByTestId('token')).toHaveTextContent('token-1');
        expect(screen.getByTestId('user-email')).toHaveTextContent(baseUser.email);
        expect(fetchMock).toHaveBeenCalledWith(
            expect.stringMatching(/\/auth\/refresh$/),
            expect.objectContaining({
                method: 'POST',
                credentials: 'include',
            })
        );
    });

    it('refreshes the session and retries the user profile request after a 401', async () => {
        const updatedUser: TestUser = {
            ...baseUser,
            name: 'Ada Updated',
            updatedAt: '2026-04-15T01:00:00.000Z',
        };

        const fetchMock = vi.fn()
            .mockResolvedValueOnce(jsonResponse({ accessToken: 'token-1', user: baseUser }))
            .mockResolvedValueOnce(new Response(null, { status: 401 }))
            .mockResolvedValueOnce(jsonResponse({ accessToken: 'token-2', user: baseUser }))
            .mockResolvedValueOnce(jsonResponse({ user: updatedUser }));
        vi.stubGlobal('fetch', fetchMock);

        render(
            <AuthProvider>
                <AuthProbe />
            </AuthProvider>
        );

        await waitFor(() => {
            expect(screen.getByTestId('token')).toHaveTextContent('token-1');
        });

        fireEvent.click(screen.getByRole('button', { name: /refresh user/i }));

        await waitFor(() => {
            expect(screen.getByTestId('token')).toHaveTextContent('token-2');
        });
        await waitFor(() => {
            expect(screen.getByTestId('user-name')).toHaveTextContent(updatedUser.name || '');
        });

        expect(fetchMock).toHaveBeenNthCalledWith(
            2,
            expect.stringMatching(/\/user\/profile$/),
            expect.objectContaining({
                credentials: 'include',
                headers: expect.objectContaining({
                    Authorization: 'Bearer token-1',
                }),
            })
        );
        expect(fetchMock).toHaveBeenNthCalledWith(
            4,
            expect.stringMatching(/\/user\/profile$/),
            expect.objectContaining({
                credentials: 'include',
                headers: expect.objectContaining({
                    Authorization: 'Bearer token-2',
                }),
            })
        );
    });
});
