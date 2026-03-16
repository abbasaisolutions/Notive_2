import { Request, Response } from 'express';
import { createHash } from 'crypto';
import prisma from '../config/prisma';
import { buildProfileContextSummary, type ProfileContextSummary } from '../services/profile-context.service';
import { deriveExperienceEvidence } from '../services/opportunity.service';
import { executeHybridSearch } from '../services/hybrid-search.service';

const TRACK_FILTERS = new Set(['all', 'personal', 'professional', 'blended', 'unknown']);
const STAGE_FILTERS = new Set(['all', 'not_started', 'in_progress', 'completed']);
const ROLE_FILTERS = new Set(['all', 'USER', 'ADMIN', 'SUPERADMIN']);
const MAX_FILTER_SCAN = 5000;

const parseProfileFilter = (value: unknown, allowed: Set<string>, fallback: string): string => {
    if (typeof value !== 'string') return fallback;
    return allowed.has(value) ? value : fallback;
};

const parseCompletionLte = (value: unknown): number | null => {
    if (typeof value !== 'string' || value.trim() === '') return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return null;
    return Math.max(0, Math.min(100, Math.floor(parsed)));
};

const sanitizeAdminText = (value: unknown, maxLength = 500): string | null => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    return trimmed.slice(0, maxLength);
};

const requireAdminReason = (value: unknown): string | null => {
    const sanitized = sanitizeAdminText(value, 240);
    if (!sanitized || sanitized.length < 8) {
        return null;
    }
    return sanitized;
};

type EvidenceRollup = {
    totalExperiences: number;
    averageCompletenessScore: number;
    readyForVerificationCount: number;
    readyForExportCount: number;
    verifiedCount: number;
    incompleteCount: number;
};

type EvidenceSummary = {
    userCount: number;
    usersWithEntries: number;
    usersReadyForVerification: number;
    usersReadyForExport: number;
    averageCompletenessScore: number;
};

type SupportIssueSeverity = 'healthy' | 'watch' | 'action';

type SupportIssue = {
    id: string;
    severity: SupportIssueSeverity;
    title: string;
    detail: string;
};

type SupportSummary = {
    state: SupportIssueSeverity;
    recommendedAction: string;
    issues: SupportIssue[];
    permissions: {
        canChangeRole: boolean;
        canBan: boolean;
        canDelete: boolean;
        canGrantSuperAdmin: boolean;
    };
};

const buildAdminAuditFingerprint = (input: {
    actorId: string;
    actorRole: string | undefined;
    targetUserId: string;
    eventType: string;
    value?: string | null;
    occurredAt: Date;
    metadata?: Record<string, unknown>;
}) => createHash('sha256').update(JSON.stringify(input)).digest('hex');

const EMPTY_EVIDENCE_ROLLUP: EvidenceRollup = {
    totalExperiences: 0,
    averageCompletenessScore: 0,
    readyForVerificationCount: 0,
    readyForExportCount: 0,
    verifiedCount: 0,
    incompleteCount: 0,
};

const getHighestSeverity = (issues: SupportIssue[]): SupportIssueSeverity => {
    if (issues.some((issue) => issue.severity === 'action')) return 'action';
    if (issues.some((issue) => issue.severity === 'watch')) return 'watch';
    return 'healthy';
};

const buildSupportSummary = (input: {
    requesterId: string;
    requesterRole: string | undefined;
    targetUser: {
        id: string;
        role: 'USER' | 'ADMIN' | 'SUPERADMIN';
        isBanned: boolean;
        _count: { entries: number; chapters: number; refreshTokens?: number };
        profileContext: ProfileContextSummary;
        socialConnections: Array<{ provider: string }>;
    };
    evidenceRollup: EvidenceRollup;
}): SupportSummary => {
    const { requesterId, requesterRole, targetUser, evidenceRollup } = input;
    const issues: SupportIssue[] = [];

    if (targetUser.isBanned) {
        issues.push({
            id: 'banned',
            severity: 'action',
            title: 'Account is suspended',
            detail: 'Confirm the original moderation reason before restoring access.',
        });
    }

    if (targetUser.profileContext.stage !== 'completed') {
        issues.push({
            id: 'onboarding',
            severity: targetUser.profileContext.stage === 'not_started' ? 'action' : 'watch',
            title: 'Onboarding is incomplete',
            detail: `Profile setup is ${targetUser.profileContext.stage.replace('_', ' ')} with ${targetUser.profileContext.completionScore}% completion.`,
        });
    }

    if (targetUser._count.entries === 0) {
        issues.push({
            id: 'no_entries',
            severity: 'action',
            title: 'No journal activity yet',
            detail: 'The user has not created any entries, so downstream insights and portfolio features will stay empty.',
        });
    } else if (evidenceRollup.incompleteCount > 0) {
        issues.push({
            id: 'evidence',
            severity: 'watch',
            title: 'Evidence is not fully structured',
            detail: `${evidenceRollup.incompleteCount} stories still need situation, action, lesson, or outcome detail.`,
        });
    }

    if (targetUser.profileContext.importPreference && targetUser.socialConnections.length === 0) {
        issues.push({
            id: 'imports',
            severity: 'watch',
            title: 'Imports expected but not connected',
            detail: `Import preference is set to ${targetUser.profileContext.importPreference}, but no active social connections were found.`,
        });
    }

    if (targetUser.role !== 'USER') {
        issues.push({
            id: 'privileged',
            severity: 'healthy',
            title: 'Privileged account',
            detail: `${targetUser.role} accounts need stricter moderation and role-change controls.`,
        });
    }

    if (issues.length === 0) {
        issues.push({
            id: 'healthy',
            severity: 'healthy',
            title: 'No immediate blockers detected',
            detail: 'Profile, activity, and evidence signals look healthy for this user.',
        });
    }

    const isSuperAdmin = requesterRole === 'SUPERADMIN';
    const isSelf = requesterId === targetUser.id;

    const permissions = {
        canChangeRole: isSuperAdmin && !isSelf,
        canBan: !isSelf && (isSuperAdmin || targetUser.role === 'USER'),
        canDelete: isSuperAdmin && !isSelf && targetUser.role !== 'SUPERADMIN',
        canGrantSuperAdmin: isSuperAdmin && targetUser.role !== 'SUPERADMIN',
    };

    const state = getHighestSeverity(issues);
    const recommendedAction = issues[0]?.detail || 'Review the user profile and recent activity for the next best support action.';

    return {
        state,
        recommendedAction,
        issues,
        permissions,
    };
};

const recordAdminAuditEvent = async (input: {
    actorId: string;
    actorRole: string | undefined;
    targetUserId: string;
    eventType: string;
    field?: string | null;
    value?: string | null;
    metadata?: Record<string, unknown>;
}) => {
    const occurredAt = new Date();
    await prisma.personalizationEvent.create({
        data: {
            userId: input.targetUserId,
            eventType: input.eventType,
            field: input.field || null,
            value: input.value || null,
            pathname: '/admin',
            metadata: {
                actorId: input.actorId,
                actorRole: input.actorRole || null,
                ...(input.metadata || {}),
            },
            occurredAt,
            fingerprint: buildAdminAuditFingerprint({
                actorId: input.actorId,
                actorRole: input.actorRole,
                targetUserId: input.targetUserId,
                eventType: input.eventType,
                value: input.value || null,
                occurredAt,
                metadata: input.metadata,
            }),
        },
    });
};

const buildEvidenceSummary = (rollups: EvidenceRollup[]): EvidenceSummary => {
    if (rollups.length === 0) {
        return {
            userCount: 0,
            usersWithEntries: 0,
            usersReadyForVerification: 0,
            usersReadyForExport: 0,
            averageCompletenessScore: 0,
        };
    }

    let usersWithEntries = 0;
    let usersReadyForVerification = 0;
    let usersReadyForExport = 0;
    let completenessTotal = 0;

    rollups.forEach((rollup) => {
        completenessTotal += rollup.averageCompletenessScore;
        if (rollup.totalExperiences === 0) {
            return;
        }

        usersWithEntries += 1;
        if (rollup.readyForVerificationCount === rollup.totalExperiences) {
            usersReadyForVerification += 1;
        }
        if (rollup.readyForExportCount === rollup.totalExperiences) {
            usersReadyForExport += 1;
        }
    });

    return {
        userCount: rollups.length,
        usersWithEntries,
        usersReadyForVerification,
        usersReadyForExport,
        averageCompletenessScore: Math.round(completenessTotal / rollups.length),
    };
};

const buildUserEvidenceRollups = async (userIds: string[]): Promise<Map<string, EvidenceRollup>> => {
    const rollups = new Map<string, EvidenceRollup>();
    if (userIds.length === 0) return rollups;
    const completenessTotals = new Map<string, number>();

    userIds.forEach((userId) => {
        rollups.set(userId, { ...EMPTY_EVIDENCE_ROLLUP });
        completenessTotals.set(userId, 0);
    });

    const entries = await prisma.entry.findMany({
        where: {
            userId: { in: userIds },
            deletedAt: null,
        },
        orderBy: { createdAt: 'desc' },
        select: {
            id: true,
            userId: true,
            title: true,
            content: true,
            mood: true,
            tags: true,
            skills: true,
            lessons: true,
            reflection: true,
            createdAt: true,
            analysis: true,
            analysisRecord: {
                select: {
                    summary: true,
                    topics: true,
                    keywords: true,
                    suggestedMood: true,
                },
            },
        },
    });

    entries.forEach((entry) => {
        const rollup = rollups.get(entry.userId);
        if (!rollup) return;

        const experience = deriveExperienceEvidence({
            id: entry.id,
            title: entry.title,
            content: entry.content,
            mood: entry.mood,
            tags: entry.tags || [],
            skills: entry.skills || [],
            lessons: entry.lessons || [],
            reflection: entry.reflection,
            createdAt: entry.createdAt,
            analysis: entry.analysis,
            analysisRecord: entry.analysisRecord || null,
        });

        rollup.totalExperiences += 1;
        rollup.readyForVerificationCount += experience.completeness.readyForVerification ? 1 : 0;
        rollup.readyForExportCount += experience.completeness.readyForExport ? 1 : 0;
        rollup.verifiedCount += experience.verified ? 1 : 0;
        rollup.incompleteCount += experience.completeness.readyForVerification ? 0 : 1;
        completenessTotals.set(
            entry.userId,
            (completenessTotals.get(entry.userId) || 0) + experience.completeness.score
        );
    });

    rollups.forEach((rollup, userId) => {
        if (rollup.totalExperiences === 0) {
            return;
        }

        rollup.averageCompletenessScore = Math.round(
            (completenessTotals.get(userId) || 0) / rollup.totalExperiences
        );
    });

    return rollups;
};

/**
 * Get all users (paginated)
 */
export const getAllUsers = async (req: Request, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const search = req.query.search as string || '';
        const skip = (page - 1) * limit;
        const track = parseProfileFilter(req.query.track, TRACK_FILTERS, 'all');
        const stage = parseProfileFilter(req.query.stage, STAGE_FILTERS, 'all');
        const canViewPrivilegedAccounts = req.userRole === 'SUPERADMIN';
        const requestedRoleFilter = parseProfileFilter(req.query.role, ROLE_FILTERS, 'all');
        const roleFilter = canViewPrivilegedAccounts ? requestedRoleFilter : 'USER';
        const completionLte = parseCompletionLte(req.query.completionLte);
        const hasProfileFilters = track !== 'all' || stage !== 'all' || completionLte !== null;

        const where = {
            ...(search ? {
                OR: [
                    { name: { contains: search, mode: 'insensitive' as const } },
                    { email: { contains: search, mode: 'insensitive' as const } },
                ],
            } : {}),
            ...(roleFilter !== 'all' ? { role: roleFilter as 'USER' | 'ADMIN' | 'SUPERADMIN' } : {}),
        };

        const userSelect = {
            id: true,
            email: true,
            name: true,
            avatarUrl: true,
            role: true,
            isBanned: true,
            createdAt: true,
            profile: {
                select: {
                    primaryGoal: true,
                    focusArea: true,
                    experienceLevel: true,
                    writingPreference: true,
                    starterPrompt: true,
                    importPreference: true,
                    lifeGoals: true,
                    outputGoals: true,
                    onboardingCompletedAt: true,
                    updatedAt: true,
                },
            },
            _count: {
                select: { entries: true },
            },
        } as const;

        let rawUsers: Array<{
            id: string;
            email: string;
            name: string | null;
            avatarUrl: string | null;
            role: 'USER' | 'ADMIN' | 'SUPERADMIN';
            isBanned: boolean;
            createdAt: Date;
            profile: {
                primaryGoal: string | null;
                focusArea: string | null;
                experienceLevel: string | null;
                writingPreference: string | null;
                starterPrompt: string | null;
                importPreference: string | null;
                lifeGoals: string[];
                outputGoals: string[];
                onboardingCompletedAt: Date | null;
                updatedAt: Date;
            } | null;
            _count: { entries: number };
        }>;
        let total = 0;

        if (hasProfileFilters) {
            rawUsers = await prisma.user.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take: MAX_FILTER_SCAN,
                select: userSelect,
            });
        } else {
            const result = await Promise.all([
                prisma.user.findMany({
                    where,
                    skip,
                    take: limit,
                    orderBy: { createdAt: 'desc' },
                    select: userSelect,
                }),
                prisma.user.count({ where }),
            ]);
            rawUsers = result[0];
            total = result[1];
        }

        const usersWithContext = rawUsers.map((user) => ({
            id: user.id,
            email: user.email,
            name: user.name,
            avatarUrl: user.avatarUrl,
            role: user.role,
            isBanned: user.isBanned,
            createdAt: user.createdAt,
            _count: user._count,
            profileContext: buildProfileContextSummary(user.profile),
        }));

        const filteredUsers = hasProfileFilters
            ? usersWithContext.filter((user) => {
                if (track !== 'all' && user.profileContext.track !== track) {
                    return false;
                }
                if (stage !== 'all' && user.profileContext.stage !== stage) {
                    return false;
                }
                if (completionLte !== null && user.profileContext.completionScore > completionLte) {
                    return false;
                }
                return true;
            })
            : usersWithContext;

        if (hasProfileFilters) {
            total = filteredUsers.length;
        }

        const pagedUsers = hasProfileFilters
            ? filteredUsers.slice(skip, skip + limit)
            : filteredUsers;

        const evidenceRollups = await buildUserEvidenceRollups(pagedUsers.map((user) => user.id));
        const users = pagedUsers.map((user) => ({
            ...user,
            evidenceRollup: evidenceRollups.get(user.id) || { ...EMPTY_EVIDENCE_ROLLUP },
        }));
        const evidenceSummary = buildEvidenceSummary(users.map((user) => user.evidenceRollup));

        return res.json({
            users,
            evidenceSummary,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
            filters: {
                track,
                stage,
                role: roleFilter,
                completionLte,
                scanLimitReached: hasProfileFilters && rawUsers.length === MAX_FILTER_SCAN,
            },
        });
    } catch (error) {
        console.error('Get all users error:', error);
        return res.status(500).json({ message: 'Failed to fetch users' });
    }
};

/**
 * Get platform statistics
 */
export const getPlatformStats = async (req: Request, res: Response) => {
    try {
        const canViewPrivilegedAccounts = req.userRole === 'SUPERADMIN';
        const [totalUsers, totalEntries, newUsersThisWeek, activeToday, adminUsers, superAdmins, bannedUsers] = await Promise.all([
            prisma.user.count(),
            prisma.entry.count({ where: { deletedAt: null } }),
            prisma.user.count({
                where: {
                    createdAt: {
                        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                    },
                },
            }),
            prisma.entry.groupBy({
                by: ['userId'],
                where: {
                    createdAt: {
                        gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
                    },
                },
            }),
            prisma.user.count({ where: { role: 'ADMIN' } }),
            prisma.user.count({ where: { role: 'SUPERADMIN' } }),
            prisma.user.count({ where: { isBanned: true } }),
        ]);

        return res.json({
            totalUsers,
            totalEntries,
            newUsersThisWeek,
            activeUsersToday: activeToday.length,
            adminUsers: canViewPrivilegedAccounts ? adminUsers : 0,
            superAdmins: canViewPrivilegedAccounts ? superAdmins : 0,
            bannedUsers,
        });
    } catch (error) {
        console.error('Get platform stats error:', error);
        return res.status(500).json({ message: 'Failed to fetch stats' });
    }
};

export const getRetrievalDebug = async (req: Request, res: Response) => {
    try {
        const requesterId = req.userId;
        const requestedUserId = typeof req.query.userId === 'string' ? req.query.userId.trim() : '';
        const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
        const limitRaw = parseInt(req.query.limit as string, 10) || 8;
        const limit = Math.min(Math.max(limitRaw, 1), 20);
        const targetUserId = requestedUserId || requesterId;

        if (!query || query.length < 2) {
            return res.status(400).json({ message: 'Query must be at least 2 characters' });
        }

        const targetUser = await prisma.user.findUnique({
            where: { id: targetUserId },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                _count: {
                    select: {
                        entries: true,
                    },
                },
            },
        });

        if (!targetUser) {
            return res.status(404).json({ message: 'Target user not found' });
        }

        const searchResult = await executeHybridSearch({
            userId: targetUser.id,
            query,
            limit,
        });

        return res.json({
            targetUser: {
                id: targetUser.id,
                email: targetUser.email,
                name: targetUser.name,
                role: targetUser.role,
                entryCount: targetUser._count.entries,
            },
            ...searchResult,
        });
    } catch (error) {
        console.error('Retrieval debug error:', error);
        return res.status(500).json({ message: 'Failed to run retrieval debug' });
    }
};

/**
 * Get single user details
 */
export const getUserDetails = async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                name: true,
                avatarUrl: true,
                role: true,
                isBanned: true,
                googleId: true,
                createdAt: true,
                updatedAt: true,
                socialConnections: {
                    select: {
                        provider: true,
                        updatedAt: true,
                        expiresAt: true,
                    },
                },
                profile: {
                    select: {
                        bio: true,
                        location: true,
                        occupation: true,
                        website: true,
                        lifeGoals: true,
                        primaryGoal: true,
                        focusArea: true,
                        experienceLevel: true,
                        writingPreference: true,
                        starterPrompt: true,
                        outputGoals: true,
                        importPreference: true,
                        onboardingCompletedAt: true,
                        updatedAt: true,
                    },
                },
                _count: {
                    select: {
                        entries: true,
                        chapters: true,
                        refreshTokens: true,
                    },
                },
            },
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (req.userRole !== 'SUPERADMIN' && user.role !== 'USER') {
            return res.status(403).json({ message: 'Super admin access required for privileged account details' });
        }

        const [evidenceRollupMap, recentEntries, recentTelemetry, recentAdminActions] = await Promise.all([
            buildUserEvidenceRollups([user.id]),
            prisma.entry.findMany({
                where: { userId: user.id, deletedAt: null },
                orderBy: { createdAt: 'desc' },
                take: 5,
                select: {
                    id: true,
                    title: true,
                    source: true,
                    mood: true,
                    createdAt: true,
                },
            }),
            prisma.personalizationEvent.findMany({
                where: { userId: user.id },
                orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
                take: 6,
                select: {
                    eventType: true,
                    field: true,
                    pathname: true,
                    occurredAt: true,
                },
            }),
            prisma.personalizationEvent.findMany({
                where: {
                    userId: user.id,
                    eventType: { startsWith: 'ADMIN_' },
                },
                orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
                take: 8,
                select: {
                    eventType: true,
                    field: true,
                    value: true,
                    metadata: true,
                    occurredAt: true,
                },
            }),
        ]);

        const evidenceRollup = evidenceRollupMap.get(user.id) || { ...EMPTY_EVIDENCE_ROLLUP };
        const profileContext = buildProfileContextSummary(user.profile);
        const supportSummary = buildSupportSummary({
            requesterId: req.userId,
            requesterRole: req.userRole,
            targetUser: {
                id: user.id,
                role: user.role,
                isBanned: user.isBanned,
                _count: user._count,
                profileContext,
                socialConnections: user.socialConnections,
            },
            evidenceRollup,
        });

        return res.json({
            user: {
                ...user,
                profileContext,
                evidenceRollup,
                supportSummary,
                recentEntries,
                recentTelemetry,
                recentAdminActions,
            },
        });
    } catch (error) {
        console.error('Get user details error:', error);
        return res.status(500).json({ message: 'Failed to fetch user' });
    }
};

/**
 * Update user role
 */
export const updateUserRole = async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;
        const { role, reason, supportNote } = req.body;
        const currentUserId = req.userId;
        const requesterRole = req.userRole;
        const auditReason = requireAdminReason(reason);
        const auditSupportNote = sanitizeAdminText(supportNote, 500);

        if (!['USER', 'ADMIN', 'SUPERADMIN'].includes(role)) {
            return res.status(400).json({ message: 'Invalid role' });
        }

        if (!auditReason) {
            return res.status(400).json({ message: 'A reason of at least 8 characters is required for role changes' });
        }

        if (requesterRole !== 'SUPERADMIN') {
            return res.status(403).json({ message: 'Only superadmins can change roles' });
        }

        if (userId === currentUserId) {
            return res.status(400).json({ message: 'Cannot change your own role' });
        }

        const targetUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { role: true },
        });

        if (!targetUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (targetUser.role === 'SUPERADMIN') {
            return res.status(403).json({ message: 'Cannot change another superadmin role' });
        }

        const user = await prisma.user.update({
            where: { id: userId },
            data: { role: role as 'USER' | 'ADMIN' | 'SUPERADMIN' },
            select: { id: true, email: true, role: true },
        });

        await recordAdminAuditEvent({
            actorId: currentUserId,
            actorRole: requesterRole,
            targetUserId: userId,
            eventType: 'ADMIN_ROLE_CHANGED',
            field: 'role',
            value: role,
            metadata: {
                previousRole: targetUser.role,
                nextRole: role,
                reason: auditReason,
                supportNote: auditSupportNote,
            },
        });

        return res.json({ message: 'Role updated', user });
    } catch (error) {
        console.error('Update user role error:', error);
        return res.status(500).json({ message: 'Failed to update role' });
    }
};

/**
 * Ban/unban user
 */
export const toggleUserBan = async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;
        const currentUserId = req.userId;
        const auditReason = requireAdminReason(req.body?.reason);
        const auditSupportNote = sanitizeAdminText(req.body?.supportNote, 500);

        if (!auditReason) {
            return res.status(400).json({ message: 'A reason of at least 8 characters is required to suspend or restore access' });
        }

        // Prevent self-ban
        if (userId === currentUserId) {
            return res.status(400).json({ message: 'Cannot ban yourself' });
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { isBanned: true, role: true },
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Prevent banning admins (only superadmin can)
        if (user.role !== 'USER' && req.userRole !== 'SUPERADMIN') {
            return res.status(403).json({ message: 'Cannot ban admins' });
        }

        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: { isBanned: !user.isBanned },
            select: { id: true, email: true, isBanned: true },
        });

        await recordAdminAuditEvent({
            actorId: currentUserId,
            actorRole: req.userRole,
            targetUserId: userId,
            eventType: 'ADMIN_BAN_TOGGLED',
            field: 'isBanned',
            value: updatedUser.isBanned ? 'true' : 'false',
            metadata: {
                previousValue: user.isBanned,
                nextValue: updatedUser.isBanned,
                reason: auditReason,
                supportNote: auditSupportNote,
            },
        });

        return res.json({
            message: updatedUser.isBanned ? 'User banned' : 'User unbanned',
            user: updatedUser,
        });
    } catch (error) {
        console.error('Toggle user ban error:', error);
        return res.status(500).json({ message: 'Failed to update ban status' });
    }
};

/**
 * Revoke all active sessions for a user
 */
export const revokeUserSessions = async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;
        const currentUserId = req.userId;
        const auditReason = requireAdminReason(req.body?.reason);
        const auditSupportNote = sanitizeAdminText(req.body?.supportNote, 500);

        if (!auditReason) {
            return res.status(400).json({ message: 'A reason of at least 8 characters is required to revoke sessions' });
        }

        if (userId === currentUserId) {
            return res.status(400).json({ message: 'Use normal logout for your own sessions' });
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { role: true },
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.role !== 'USER' && req.userRole !== 'SUPERADMIN') {
            return res.status(403).json({ message: 'Cannot revoke admin sessions' });
        }

        const revoked = await prisma.refreshToken.deleteMany({
            where: { userId },
        });

        await recordAdminAuditEvent({
            actorId: currentUserId,
            actorRole: req.userRole,
            targetUserId: userId,
            eventType: 'ADMIN_SESSIONS_REVOKED',
            field: 'refreshTokens',
            value: String(revoked.count),
            metadata: {
                revokedSessions: revoked.count,
                reason: auditReason,
                supportNote: auditSupportNote,
            },
        });

        return res.json({
            message: revoked.count > 0 ? 'User sessions revoked' : 'No active sessions found',
            revokedSessions: revoked.count,
        });
    } catch (error) {
        console.error('Revoke user sessions error:', error);
        return res.status(500).json({ message: 'Failed to revoke sessions' });
    }
};

/**
 * Delete user (superadmin only)
 */
export const deleteUser = async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;
        const currentUserId = req.userId;
        const auditReason = requireAdminReason(req.body?.reason);
        const auditSupportNote = sanitizeAdminText(req.body?.supportNote, 500);

        if (!auditReason) {
            return res.status(400).json({ message: 'A reason of at least 8 characters is required to delete a user' });
        }

        // Prevent self-deletion
        if (userId === currentUserId) {
            return res.status(400).json({ message: 'Cannot delete yourself' });
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { role: true },
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Prevent deleting other superadmins
        if (user.role === 'SUPERADMIN') {
            return res.status(403).json({ message: 'Cannot delete superadmins' });
        }

        await recordAdminAuditEvent({
            actorId: currentUserId,
            actorRole: req.userRole,
            targetUserId: userId,
            eventType: 'ADMIN_USER_DELETED',
            value: user.role,
            metadata: {
                deletedRole: user.role,
                reason: auditReason,
                supportNote: auditSupportNote,
            },
        });

        await prisma.user.delete({
            where: { id: userId },
        });

        return res.json({ message: 'User deleted' });
    } catch (error) {
        console.error('Delete user error:', error);
        return res.status(500).json({ message: 'Failed to delete user' });
    }
};

