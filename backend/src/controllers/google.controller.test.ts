import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { googleSignIn } from './google.controller';

const prismaMock = vi.hoisted(() => ({
    user: {
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        findUnique: vi.fn(),
    },
    refreshToken: {
        create: vi.fn(),
    },
}));

const verifyGoogleCredentialMock = vi.hoisted(() => vi.fn());
const sendWelcomeEmailMock = vi.hoisted(() => vi.fn());

vi.mock('../config/prisma', () => ({
    default: prismaMock,
}));

vi.mock('../utils/google-auth', () => ({
    verifyGoogleCredential: verifyGoogleCredentialMock,
}));

vi.mock('../utils/jwt', () => ({
    generateAccessToken: vi.fn(() => 'access-token'),
    generateRefreshToken: vi.fn(() => 'refresh-token'),
    getMobileRefreshTokenExpiry: vi.fn(() => new Date('2026-11-20T10:00:00Z')),
}));

vi.mock('../utils/token-security', () => ({
    hashToken: vi.fn((token: string) => `hashed-${token}`),
}));

vi.mock('../utils/refresh-token-cookie', () => ({
    setRefreshTokenCookie: vi.fn(),
}));

vi.mock('../services/email.service', () => ({
    emailService: {
        sendWelcomeEmail: sendWelcomeEmailMock,
    },
}));

const buildResponse = () => {
    const res = {
        status: vi.fn(),
        json: vi.fn(),
        cookie: vi.fn(),
    } as unknown as Response & {
        status: ReturnType<typeof vi.fn>;
        json: ReturnType<typeof vi.fn>;
    };

    res.status.mockReturnValue(res);
    res.json.mockReturnValue(res);

    return res;
};

describe('googleSignIn', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        sendWelcomeEmailMock.mockResolvedValue(undefined);
    });

    it('creates a first-time Google user and returns a refresh token for Android', async () => {
        const createdUser = {
            id: 'user-new',
            email: 'new@example.com',
            name: 'New User',
            avatarUrl: 'https://example.com/avatar.png',
            role: 'USER',
            password: null,
            createdAt: new Date('2026-05-24T10:00:00Z'),
            updatedAt: new Date('2026-05-24T10:00:00Z'),
        };

        verifyGoogleCredentialMock.mockResolvedValue({
            googleId: 'google-new',
            email: 'New@Example.com',
            name: 'New User',
            picture: 'https://example.com/avatar.png',
        });
        prismaMock.user.findFirst.mockResolvedValue(null);
        prismaMock.user.create.mockResolvedValue(createdUser);
        prismaMock.user.findUnique.mockResolvedValue({ ...createdUser, profile: null });
        prismaMock.refreshToken.create.mockResolvedValue({});

        const req = {
            body: { credential: 'valid-id-token' },
            header: vi.fn((name: string) => (name.toLowerCase() === 'x-client-platform' ? 'mobile' : undefined)),
        } as unknown as Request;
        const res = buildResponse();

        await googleSignIn(req, res);

        expect(prismaMock.user.create).toHaveBeenCalledWith({
            data: {
                email: 'new@example.com',
                googleId: 'google-new',
                name: 'New User',
                avatarUrl: 'https://example.com/avatar.png',
            },
        });
        expect(prismaMock.refreshToken.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                token: 'hashed-refresh-token',
                userId: 'user-new',
            }),
        });
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            accessToken: 'access-token',
            refreshToken: 'refresh-token',
            user: expect.objectContaining({
                id: 'user-new',
                email: 'new@example.com',
                profile: null,
            }),
        }));
        expect(sendWelcomeEmailMock).toHaveBeenCalledWith(createdUser);
    });
});
