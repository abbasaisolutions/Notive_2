'use client';

import React from 'react';
import { buildProfileContextSummary, type ProfileContextSource } from '@/services/profile-context.service';
import { NOTIVE_VOICE } from '@/content/notive-voice';
import {
    FiBell,
    FiBookOpen,
    FiBriefcase,
    FiFolder,
    FiHome,
    FiMessageCircle,
    FiPlus,
    FiShield,
    FiUploadCloud,
    FiUser,
} from 'react-icons/fi';

export type NavItem = {
    href: string;
    label: string;
    shortLabel?: string;
    icon: React.ReactNode;
    isMain?: boolean;
    matchPrefixes?: string[];
    allowedRoles?: string[];
};

export type NavSection = {
    id: string;
    label: string;
    items: NavItem[];
};

export type JourneyStageId = 'capture' | 'organize' | 'reflect' | 'apply' | 'account';
export type WorkspaceMaturity = 'new' | 'growing' | 'power';

export type BreadcrumbItem = {
    label: string;
    href?: string;
};

export type RouteAction = {
    label: string;
    href: string;
    shortLabel?: string;
};

export type RouteMeta = {
    title: string;
    description: string;
    section: string;
    breadcrumbs: BreadcrumbItem[];
    primaryAction?: RouteAction;
    secondaryAction?: RouteAction;
    visibleInfo: string[];
    journeyStage: JourneyStageId;
    headerMode?: 'standard' | 'none';
    showResumeCard?: boolean;
};

export type JourneyStage = {
    id: JourneyStageId;
    label: string;
    description: string;
    href: string;
};

const icons = {
    home: <FiHome aria-hidden="true" />,
    write: <FiPlus aria-hidden="true" />,
    memories: <FiBookOpen aria-hidden="true" />,
    notifications: <FiBell aria-hidden="true" />,
    guide: <FiMessageCircle aria-hidden="true" />,
    profile: <FiUser aria-hidden="true" />,
    chapters: <FiFolder aria-hidden="true" />,
    stories: <FiBriefcase aria-hidden="true" />,
    imports: <FiUploadCloud aria-hidden="true" />,
    admin: <FiShield aria-hidden="true" />,
};

const homeNavItem: NavItem = { href: '/dashboard', label: NOTIVE_VOICE.surfaces.homeBase, shortLabel: 'Today', icon: icons.home, matchPrefixes: ['/dashboard'] };
const writeNavItem: NavItem = { href: '/entry/new', label: 'Write', shortLabel: 'Write', icon: icons.write, isMain: true, matchPrefixes: ['/entry/new', '/entry/edit'] };
const memoriesNavItem: NavItem = { href: '/timeline', label: NOTIVE_VOICE.surfaces.memoryAtlas, shortLabel: 'Timeline', icon: icons.memories, matchPrefixes: ['/timeline'] };
const notificationsNavItem: NavItem = { href: '/notifications', label: 'Notifications', shortLabel: 'Alerts', icon: icons.notifications, matchPrefixes: ['/notifications'] };
const guideNavItem: NavItem = { href: '/chat', label: NOTIVE_VOICE.surfaces.reflectionCoach, shortLabel: 'Chat', icon: icons.guide, matchPrefixes: ['/chat'] };
const groupsNavItem: NavItem = { href: '/chapters', label: NOTIVE_VOICE.surfaces.storyCollections, shortLabel: 'Threads', icon: icons.chapters, matchPrefixes: ['/chapters'] };
const importsNavItem: NavItem = { href: '/import', label: NOTIVE_VOICE.surfaces.memoryInbox, shortLabel: 'Import', icon: icons.imports, matchPrefixes: ['/import'] };
// Naming alias note: the user-facing "Stories" surface lives at /portfolio and
// is labeled from NOTIVE_VOICE.surfaces.outcomeStudio.
const storiesNavItem: NavItem = { href: '/portfolio', label: NOTIVE_VOICE.surfaces.outcomeStudio, shortLabel: 'Use', icon: icons.stories, matchPrefixes: ['/portfolio'] };
const profileNavItem: NavItem = { href: '/profile', label: NOTIVE_VOICE.surfaces.profileStudio, shortLabel: 'Profile', icon: icons.profile, matchPrefixes: ['/profile'] };
const adminNavItem: NavItem = { href: '/admin', label: 'Admin', shortLabel: 'Admin', icon: icons.admin, matchPrefixes: ['/admin'], allowedRoles: ['ADMIN', 'SUPERADMIN'] };

export const getWorkspaceMaturity = ({
    role,
    profile,
    totalEntries,
}: {
    role?: string | null;
    profile?: ProfileContextSource | null;
    totalEntries?: number | null;
}): WorkspaceMaturity => {
    if (role === 'ADMIN' || role === 'SUPERADMIN') return 'power';

    const entryCount = Math.max(totalEntries || 0, 0);
    const profileSummary = buildProfileContextSummary(profile ?? null);

    if (entryCount >= 15) return 'power';
    if (entryCount >= 5 || (entryCount >= 3 && profileSummary.stage === 'completed')) return 'growing';
    return 'new';
};

export const getDesktopNavSections = (maturity: WorkspaceMaturity): NavSection[] => {
    if (maturity === 'new') {
        return [
            { id: 'main', label: 'Main', items: [homeNavItem, writeNavItem, memoriesNavItem] },
            { id: 'account', label: 'Account', items: [notificationsNavItem, profileNavItem, adminNavItem] },
        ];
    }

    if (maturity === 'growing') {
        return [
            { id: 'main', label: 'Main', items: [homeNavItem, writeNavItem, memoriesNavItem, guideNavItem] },
            { id: 'account', label: 'Account', items: [notificationsNavItem, profileNavItem, adminNavItem] },
        ];
    }

    return [
        { id: 'main', label: 'Main', items: [homeNavItem, writeNavItem, memoriesNavItem, guideNavItem] },
        { id: 'more', label: 'More', items: [groupsNavItem, importsNavItem, storiesNavItem] },
        { id: 'account', label: 'Account', items: [notificationsNavItem, profileNavItem, adminNavItem] },
    ];
};

export const getMobileMainNavItems = (maturity: WorkspaceMaturity): NavItem[] => {
    if (maturity === 'new') {
        return [homeNavItem, memoriesNavItem, writeNavItem, profileNavItem];
    }

    return [homeNavItem, memoriesNavItem, writeNavItem, guideNavItem, profileNavItem];
};

export const getMobileMoreNavSections = (_maturity: WorkspaceMaturity): NavSection[] => {
    // Only admin items remain in the More drawer.
    // Regular users see Today, Timeline, +Write, Chat, Profile in the bottom bar.
    return [
        {
            id: 'admin',
            label: 'Admin',
            items: [adminNavItem],
        },
    ];
};

export const journeyStages: JourneyStage[] = [
    { id: 'capture', label: 'Write', description: 'Capture a real moment while it is still fresh.', href: '/entry/new' },
    { id: 'organize', label: 'Threads', description: 'Follow related memories, emotions, people, and themes over time.', href: '/chapters' },
    { id: 'reflect', label: 'Chat', description: 'Understand your notes, find threads, and ask better questions.', href: '/chat' },
    { id: 'apply', label: 'Use', description: 'Turn saved moments into material you can use elsewhere.', href: '/portfolio' },
    { id: 'account', label: 'Profile', description: 'Your goals, settings, and privacy.', href: '/profile' },
];

const routeMetaByPrefix: Array<{ prefix: string; meta: RouteMeta }> = [
    {
        prefix: '/notifications',
        meta: {
            title: 'Notifications',
            description: 'Review recent reminders, shared-memory activity, and inbox updates in one place.',
            section: 'Account',
            breadcrumbs: [{ label: 'Today', href: '/dashboard' }, { label: 'Notifications' }],
            primaryAction: { label: 'Open Timeline', shortLabel: 'Timeline', href: '/timeline?view=shared' },
            secondaryAction: { label: 'Edit Alerts', shortLabel: 'Settings', href: '/profile/edit?tab=reminders' },
            visibleInfo: ['Unread items', 'Recent activity', 'Notification settings'],
            journeyStage: 'account',
            headerMode: 'none',
        },
    },
    {
        prefix: '/dashboard',
        meta: {
            title: 'Today',
            description: 'Your private overview: latest note, active threads, and one next step.',
            section: 'Main',
            breadcrumbs: [{ label: 'Today', href: '/dashboard' }, { label: 'Today' }],
            primaryAction: { label: 'Write', shortLabel: 'Write', href: '/entry/new' },
            secondaryAction: { label: 'Open Timeline', shortLabel: 'Timeline', href: '/timeline' },
            visibleInfo: ['Latest note', 'Active threads', 'Next step'],
            journeyStage: 'capture',
            headerMode: 'none',
        },
    },
    {
        prefix: '/timeline',
        meta: {
            title: 'Timeline',
            description: 'Look back at your private notes in order and reopen old moments quickly.',
            section: 'Main',
            breadcrumbs: [{ label: 'Today', href: '/dashboard' }, { label: 'Timeline' }],
            primaryAction: { label: 'Write', shortLabel: 'Write', href: '/entry/new?mode=quick' },
            secondaryAction: { label: 'Open Threads', shortLabel: 'Threads', href: '/chapters' },
            visibleInfo: ['Dates', 'Search', 'Threads'],
            journeyStage: 'capture',
            headerMode: 'none',
        },
    },
    {
        prefix: '/entry/view',
        meta: {
            title: 'Memory',
            description: 'Read one memory with its feeling, tags, and details.',
            section: 'Main',
            breadcrumbs: [{ label: 'Today', href: '/dashboard' }, { label: 'Timeline', href: '/timeline' }, { label: 'Memory' }],
            primaryAction: { label: 'Write', shortLabel: 'Write', href: '/entry/new' },
            secondaryAction: { label: 'Open Timeline', shortLabel: 'Timeline', href: '/timeline' },
            visibleInfo: ['Memory text', 'Feeling', 'Related memories'],
            journeyStage: 'capture',
            headerMode: 'none',
        },
    },
    {
        prefix: '/shared/view',
        meta: {
            title: 'Shared memory',
            description: 'Review a bundle someone sent you, react to it, and decide what you want to carry forward.',
            section: 'Main',
            breadcrumbs: [{ label: 'Today', href: '/dashboard' }, { label: 'Timeline', href: '/timeline' }, { label: 'Shared memory' }],
            primaryAction: { label: 'Open Timeline', shortLabel: 'Timeline', href: '/timeline' },
            secondaryAction: { label: 'Write', shortLabel: 'Write', href: '/entry/new' },
            visibleInfo: ['Sender', 'Shared memories', 'Reaction'],
            journeyStage: 'capture',
            headerMode: 'standard',
        },
    },
    {
        prefix: '/chapters',
        meta: {
            title: 'Threads',
            description: 'Follow recurring themes, people, emotions, seasons, and life areas across your notes.',
            section: 'Organize',
            breadcrumbs: [{ label: 'Today', href: '/dashboard' }, { label: 'Threads' }],
            primaryAction: { label: 'Write', shortLabel: 'Write', href: '/entry/new' },
            secondaryAction: { label: 'Open Timeline', shortLabel: 'Timeline', href: '/timeline' },
            visibleInfo: ['Threads', 'Memory counts', 'Topics'],
            journeyStage: 'organize',
            headerMode: 'none',
        },
    },
    {
        prefix: '/import',
        meta: {
            title: 'Import',
            description: 'Import old posts, notes, and files. They join your timeline like any other note.',
            section: 'Organize',
            breadcrumbs: [{ label: 'Today', href: '/dashboard' }, { label: 'Import' }],
            primaryAction: { label: 'Open Timeline', shortLabel: 'Timeline', href: '/timeline' },
            secondaryAction: { label: 'Open Stories', shortLabel: 'Stories', href: '/portfolio?view=evidence' },
            visibleInfo: ['Connected apps', 'Import queue', 'Ready items'],
            journeyStage: 'organize',
            headerMode: 'none',
        },
    },
    {
        prefix: '/chat',
        meta: {
            title: 'Chat',
            description: 'Ask about anything you have written.',
            section: 'Reflect',
            breadcrumbs: [{ label: 'Today', href: '/dashboard' }, { label: 'Chat' }],
            primaryAction: { label: 'Open Timeline', shortLabel: 'Timeline', href: '/timeline' },
            secondaryAction: { label: 'Write', shortLabel: 'Write', href: '/entry/new' },
            visibleInfo: ['Notes', 'Threads', 'Questions'],
            journeyStage: 'reflect',
            headerMode: 'none',
        },
    },
    {
        prefix: '/portfolio',
        meta: {
            title: 'Stories',
            description: 'Turn private notes into resume, statement, interview, and growth material.',
            section: 'Apply',
            breadcrumbs: [{ label: 'Today', href: '/dashboard' }, { label: 'Stories' }],
            primaryAction: { label: 'Write', shortLabel: 'Write', href: '/entry/new' },
            secondaryAction: { label: 'Open Profile', shortLabel: 'Profile', href: '/profile/edit' },
            visibleInfo: ['Stories', 'Resume moments', 'Exports'],
            journeyStage: 'apply',
            headerMode: 'none',
        },
    },
    {
        prefix: '/profile',
        meta: {
            title: 'Profile',
            description: 'Your profile, goals, settings, and privacy.',
            section: 'Account',
            breadcrumbs: [{ label: 'Today', href: '/dashboard' }, { label: 'Profile' }],
            primaryAction: { label: 'Edit profile', shortLabel: 'Edit', href: '/profile/edit' },
            secondaryAction: { label: 'Privacy & Data', shortLabel: 'Privacy', href: '/profile/edit?tab=privacy' },
            visibleInfo: ['Goals', 'Settings', 'Privacy'],
            journeyStage: 'account',
            headerMode: 'none',
        },
    },
    {
        prefix: '/admin',
        meta: {
            title: 'Admin',
            description: 'Support users and manage accounts.',
            section: 'Account',
            breadcrumbs: [{ label: 'Today', href: '/dashboard' }, { label: 'Admin' }],
            primaryAction: { label: 'Review Users', shortLabel: 'Review', href: '/admin' },
            secondaryAction: { label: 'Open Profile', shortLabel: 'Profile', href: '/profile' },
            visibleInfo: ['Users', 'Support', 'Safety'],
            journeyStage: 'account',
            headerMode: 'none',
        },
    },
];

export const isNavItemActive = (pathname: string | null | undefined, item: NavItem): boolean => {
    if (!pathname) return false;
    if (pathname === item.href) return true;
    if (item.matchPrefixes?.some((prefix) => pathname.startsWith(prefix))) return true;
    if (item.href !== '/dashboard' && pathname.startsWith(item.href)) return true;
    return false;
};

const isRoleAllowed = (item: NavItem, role: string | null | undefined): boolean => {
    if (!item.allowedRoles || item.allowedRoles.length === 0) return true;
    if (!role) return false;
    return item.allowedRoles.includes(role.toUpperCase());
};

export const filterNavItemsByRole = (items: NavItem[], role: string | null | undefined): NavItem[] =>
    items.filter((item) => isRoleAllowed(item, role));

export const filterNavSectionsByRole = (sections: NavSection[], role: string | null | undefined): NavSection[] =>
    sections
        .map((section) => ({ ...section, items: filterNavItemsByRole(section.items, role) }))
        .filter((section) => section.items.length > 0);

export const getRouteMeta = (pathname: string | null | undefined): RouteMeta | null => {
    if (!pathname || shouldHideGlobalNav(pathname)) return null;
    const matched = routeMetaByPrefix.find((item) => pathname.startsWith(item.prefix));
    return matched?.meta ?? null;
};

export const getCurrentJourneyStage = (pathname: string | null | undefined): JourneyStageId | null => {
    const meta = getRouteMeta(pathname);
    return meta?.journeyStage ?? null;
};

export const shouldHideGlobalNav = (pathname?: string | null): boolean => {
    if (!pathname) return true;

    const hiddenPrefixes = [
        '/login',
        '/register',
        '/onboarding',
        '/forgot-password',
        '/reset-password',
        '/terms',
        '/privacy',
        '/share',
        '/entry/new',
        '/entry/edit',
    ];
    const hiddenExact = new Set(['/']);
    return hiddenExact.has(pathname) || hiddenPrefixes.some((prefix) => pathname.startsWith(prefix));
};
