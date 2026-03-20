import { Request, Response } from 'express';
import prisma from '../config/prisma';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const sanitizeEmail = (value: unknown): string | null => {
    if (typeof value !== 'string') {
        return null;
    }

    const normalized = value.trim().toLowerCase();
    if (!normalized || !EMAIL_REGEX.test(normalized)) {
        return null;
    }

    return normalized.slice(0, 320);
};

const sanitizeOptionalReason = (value: unknown, maxLength = 2000): string | null => {
    if (typeof value !== 'string') {
        return null;
    }

    const trimmed = value.trim();
    if (!trimmed) {
        return null;
    }

    return trimmed.slice(0, maxLength);
};

export const createAccountDeletionRequest = async (req: Request, res: Response) => {
    try {
        const email = sanitizeEmail(req.body?.email);
        const reason = sanitizeOptionalReason(req.body?.reason);

        if (!email) {
            return res.status(400).json({
                message: 'Enter the email address tied to the account you want to delete.',
            });
        }

        const existingPendingRequest = await prisma.accountDeletionRequest.findFirst({
            where: {
                normalizedEmail: email,
                status: 'PENDING',
            },
            orderBy: {
                createdAt: 'desc',
            },
        });

        if (existingPendingRequest) {
            return res.status(202).json({
                message: 'A deletion request for this email is already pending review.',
            });
        }

        const matchedUser = await prisma.user.findUnique({
            where: { email },
            select: { id: true },
        });

        await prisma.accountDeletionRequest.create({
            data: {
                email,
                normalizedEmail: email,
                reason,
                requestedVia: 'WEB',
                matchedUserId: matchedUser?.id || null,
            },
        });

        return res.status(202).json({
            message: 'Your deletion request has been received and queued for review.',
        });
    } catch (error) {
        console.error('Create account deletion request error:', error);
        return res.status(500).json({
            message: 'Failed to submit your deletion request.',
        });
    }
};
