import prisma from '../config/prisma';
import { serverLogger } from '../utils/server-logger';

type JoinedUser = {
    id: string;
    name: string | null;
    email: string;
};

/**
 * Admin-only operational alert. This deliberately uses in-app notifications
 * (not the public notification preferences) and never sends a user-facing alert.
 */
export const notifyAdminsOfNewUser = async (newUser: JoinedUser): Promise<void> => {
    const admins = await prisma.user.findMany({
        where: { role: { in: ['ADMIN', 'SUPERADMIN'] } },
        select: { id: true },
    });

    if (admins.length === 0) return;

    const displayName = newUser.name?.trim() || newUser.email;
    await prisma.inAppNotification.createMany({
        data: admins.map((admin) => ({
            userId: admin.id,
            type: 'admin_new_user',
            title: 'New user joined',
            body: `${displayName} just created an account.`,
            data: {
                userId: newUser.id,
                source: 'google_sso',
                link: `/admin?userId=${newUser.id}`,
            },
        })),
    });

    serverLogger.info('admin.new_user_notified', {
        userId: newUser.id,
        recipientCount: admins.length,
    });
};
