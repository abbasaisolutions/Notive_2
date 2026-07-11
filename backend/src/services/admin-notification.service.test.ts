import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
    user: { findMany: vi.fn() },
    inAppNotification: { createMany: vi.fn() },
}));

vi.mock('../config/prisma', () => ({ default: prismaMock }));
vi.mock('../utils/server-logger', () => ({
    serverLogger: { info: vi.fn() },
}));

import { notifyAdminsOfNewUser } from './admin-notification.service';

describe('notifyAdminsOfNewUser', () => {
    beforeEach(() => vi.clearAllMocks());

    it('creates an in-app alert only for admin roles', async () => {
        prismaMock.user.findMany.mockResolvedValue([{ id: 'admin-1' }, { id: 'superadmin-1' }]);
        prismaMock.inAppNotification.createMany.mockResolvedValue({ count: 2 });

        await notifyAdminsOfNewUser({ id: 'new-user', name: 'Ari', email: 'ari@example.com' });

        expect(prismaMock.user.findMany).toHaveBeenCalledWith({
            where: { role: { in: ['ADMIN', 'SUPERADMIN'] } },
            select: { id: true },
        });
        expect(prismaMock.inAppNotification.createMany).toHaveBeenCalledWith({
            data: expect.arrayContaining([
                expect.objectContaining({ userId: 'admin-1', type: 'admin_new_user', body: 'Ari just created an account.' }),
                expect.objectContaining({ userId: 'superadmin-1', type: 'admin_new_user' }),
            ]),
        });
    });

    it('does nothing when no admin account exists', async () => {
        prismaMock.user.findMany.mockResolvedValue([]);

        await notifyAdminsOfNewUser({ id: 'new-user', name: null, email: 'ari@example.com' });

        expect(prismaMock.inAppNotification.createMany).not.toHaveBeenCalled();
    });
});
