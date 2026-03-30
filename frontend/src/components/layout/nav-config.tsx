'use client';

import React from 'react';
import { buildProfileContextSummary, type ProfileContextSource } from '@/services/profile-context.service';
import {
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
    guide: <FiMessageCircle aria-hidden="true" />,
    profile: <FiUser aria-hidden="true" />,
    chapters: <FiFolder aria-hidden="true" />,
    stories: <FiBriefcase aria-hidden="true" />,
    imports: <FiUploadCloud aria-hidden="true" />,
    admin: <FiShield aria-hidden="true" />,
};

const homeNavItem: NavItem = { href: '/dashboard', label: 'Home', shortLabel: 'Home', icon: icons.home, matchPrefixes: ['/dashboard'] };
const writeNavItem: NavItem = { href: '/entry/new', label: 'Write', shortLabel: 'Write', icon: icons.write, isMain: true, matchPrefixes: ['/entry/new', '/entry/edit'] };
const memoriesNavItem: NavItem = { href: '/timeline', label: 'Memories', shortLabel: 'Memories', icon: icons.memories, matchPrefixes: ['/timeline'] };
const guideNavItem: NavItem = { href: '/chat', label: 'Guide', shortLabel: 'Guide', icon: icons.guide, matchPrefixes: ['/chat'] };
const groupsNavItem: NavItem = { href: '/chapters', label: 'Groups', shortLabel: 'Groups', icon: icons.chapters, matchPrefixes: ['/chapters'] };
const importsNavItem: NavItem = { href: '/import', label: 'Imports', shortLabel: 'Imports', icon: icons.imports, matchPrefixes: ['/import'] };
const storiesNavItem: NavItem = { href: '/portfolio', label: 'Stories', shortLabel: 'Stories', icon: icons.stories, matchPrefixes: ['/portfolio'] };
const profileNavItem: NavItem = { href: '/profile', label: 'Me', shortLabel: 'Me', icon: icons.profile, matchPrefixes: ['/profile'] };
const adminNavItem: NavItem = { href: '/admin', label: 'Admin', shortLabel: 'Admin', icon: icons.admin, matchPrefixes: ['/admin'], allowedRoles: ['ADMIN', 'SUPERADMIN'] };

export const primaryNavItems: NavItem[] = [
    homeNavItem,
    writeNavItem,
    memoriesNavItem,
    guideNavItem,
];

export const secondaryNavItems: NavItem[] = [
    groupsNavItem,
    importsNavItem,
    storiesNavItem,
    profileNavItem,
    adminNavItem,
];

export const desktopNavSections: NavSection[] = [
    { id: 'capture', label: 'Main', items: primaryNavItems },
    { id: 'organize', label: 'More', items: secondaryNavItems },
];

export const mobileMainNavItems: NavItem[] = [
    primaryNavItems[0],
    primaryNavItems[2],
    primaryNavItems[1],
    primaryNavItems[3],
];

export const mobileMoreNavSections: NavSection[] = [
    {
        id: 'organize',
        label: 'More',
        items: secondaryNavItems.filter((item) => item.href === '/chapters' || item.href === '/import' || item.href === '/portfolio'),
    },
    {
        id: 'account',
        label: 'Account',
        items: secondaryNavItems.filter((item) => item.href === '/profile' || item.href === '/admin'),
    },
];

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
            { id: 'account', label: 'Account', items: [profileNavItem, adminNavItem] },
        ];
    }

    if (maturity === 'growing') {
        return [
            { id: 'main', label: 'Main', items: [homeNavItem, writeNavItem, memoriesNavItem, guideNavItem] },
            { id: 'account', label: 'Account', items: [profileNavItem, adminNavItem] },
        ];
    }

    return [
        { id: 'main', label: 'Main', items: [homeNavItem, writeNavItem, memoriesNavItem, guideNavItem] },
        { id: 'more', label: 'More', items: [groupsNavItem, importsNavItem, storiesNavItem] },
        { id: 'account', label: 'Account', items: [profileNavItem, adminNavItem] },
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
    // Regular users see Home, Memories, +Write, Guide, Me in the bottom bar.
    return [
        {
            id: 'admin',
            label: 'Admin',
            items: [adminNavItem],
        },
    ];
};

export const getProfileReadinessAction = (completionScore: number): RouteAction => {
    if (completionScore < 100) {
        return {
            label: 'Continue Setup',
            shortLabel: 'Continue',
            href: '/onboarding',
        };
    }

    return {
        label: 'Refine Profile',
        shortLabel: 'Me',
        href: '/profile/edit',
    };
};

export const journeyStages: JourneyStage[] = [
    { id: 'capture', label: 'Write', description: 'Save moments while they are still fresh.', href: '/entry/new' },
    { id: 'organize', label: 'Groups', description: 'Group related memories so they are easy to find.', href: '/chapters' },
    { id: 'reflect', label: 'Guide', description: 'Get grounded advice based on your notes.', href: '/chat' },
    { id: 'apply', label: 'Stories', description: 'Turn moments into clear stories you can use later.', href: '/portfolio' },
    { id: 'account', label: 'Me', description: 'Choose your goals, settings, and privacy.', href: '/profile' },
];

const routeMetaByPrefix: Array<{ prefix: string; meta: RouteMeta }> = [
    {
        prefix: '/dashboard',
        meta: {
            title: 'Home',
            description: 'Pick up where you left off, write something new, or reopen a useful thread from your notes.',
            section: 'Main',
            breadcrumbs: [{ label: 'Home', href: '/dashboard' }, { label: 'Home' }],
            primaryAction: { label: 'Write', shortLabel: 'Write', href: '/entry/new' },
            secondaryAction: { label: 'Open Memories', shortLabel: 'Memories', href: '/timeline' },
            visibleInfo: ['Recent notes', 'Days in a row', 'Next step'],
            journeyStage: 'capture',
            headerMode: 'none',
        },
    },
    {
        prefix: '/timeline',
        meta: {
            title: 'Memories',
            description: 'Look back at your notes in order and reopen old moments quickly.',
            section: 'Main',
            breadcrumbs: [{ label: 'Home', href: '/dashboard' }, { label: 'Memories' }],
            primaryAction: { label: 'Write', shortLabel: 'Write', href: '/entry/new?mode=quick' },
            secondaryAction: { label: 'Open Groups', shortLabel: 'Groups', href: '/chapters' },
            visibleInfo: ['Dates', 'Search', 'Topics'],
            journeyStage: 'capture',
            headerMode: 'none',
        },
    },
    {
        prefix: '/entry/view',
        meta: {
            title: 'Note',
            description: 'Read one note with its feeling, tags, and details.',
            section: 'Main',
            breadcrumbs: [{ label: 'Home', href: '/dashboard' }, { label: 'Memories', href: '/timeline' }, { label: 'Note' }],
            primaryAction: { label: 'Write', shortLabel: 'Write', href: '/entry/new' },
            secondaryAction: { label: 'Open Memories', shortLabel: 'Memories', href: '/timeline' },
            visibleInfo: ['Note text', 'Feeling', 'Related notes'],
            journeyStage: 'capture',
        },
    },
    {
        prefix: '/chapters',
        meta: {
            title: 'Groups',
            description: 'Put related notes into simple groups by project, season, or part of life.',
            section: 'Organize',
            breadcrumbs: [{ label: 'Home', href: '/dashboard' }, { label: 'Groups' }],
            primaryAction: { label: 'Write', shortLabel: 'Write', href: '/entry/new' },
            secondaryAction: { label: 'Open Memories', shortLabel: 'Memories', href: '/timeline' },
            visibleInfo: ['Groups', 'Note counts', 'Topics'],
            journeyStage: 'organize',
            headerMode: 'none',
        },
    },
    {
        prefix: '/import',
        meta: {
            title: 'Imports',
            description: 'Bring old posts, notes, and files into Notive so they can become useful stories.',
            section: 'Organize',
            breadcrumbs: [{ label: 'Home', href: '/dashboard' }, { label: 'Imports' }],
            primaryAction: { label: 'Open Memories', shortLabel: 'Memories', href: '/timeline' },
            secondaryAction: { label: 'Open Stories', shortLabel: 'Stories', href: '/portfolio?view=evidence' },
            visibleInfo: ['Connected apps', 'Import queue', 'Ready items'],
            journeyStage: 'organize',
            headerMode: 'none',
        },
    },
    {
        prefix: '/chat',
        meta: {
            title: 'Guide',
            description: 'Get grounded advice based on your notes — one next step, one support draft, or a clearer question.',
            section: 'Reflect',
            breadcrumbs: [{ label: 'Home', href: '/dashboard' }, { label: 'Guide' }],
            primaryAction: { label: 'Open Memories', shortLabel: 'Memories', href: '/timeline' },
            secondaryAction: { label: 'Write', shortLabel: 'Write', href: '/entry/new' },
            visibleInfo: ['Action brief', 'Bridge draft', 'Next step'],
            journeyStage: 'reflect',
            headerMode: 'none',
        },
    },
    {
        prefix: '/portfolio',
        meta: {
            title: 'Stories',
            description: 'Open resume, statement, interview, and growth tools built from your notes.',
            section: 'Apply',
            breadcrumbs: [{ label: 'Home', href: '/dashboard' }, { label: 'Stories' }],
            primaryAction: { label: 'Write', shortLabel: 'Write', href: '/entry/new' },
            secondaryAction: { label: 'Open Me', shortLabel: 'Me', href: '/profile/edit' },
            visibleInfo: ['Story quality', 'Practice', 'Exports'],
            journeyStage: 'apply',
            headerMode: 'none',
        },
    },
    {
        prefix: '/profile',
        meta: {
            title: 'Me',
            description: 'Your profile, goals, settings, and privacy.',
            section: 'Account',
            breadcrumbs: [{ label: 'Home', href: '/dashboard' }, { label: 'Me' }],
            primaryAction: { label: 'Edit Me', shortLabel: 'Edit', href: '/profile/edit' },
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
            breadcrumbs: [{ label: 'Home', href: '/dashboard' }, { label: 'Admin' }],
            primaryAction: { label: 'Review Users', shortLabel: 'Review', href: '/admin' },
            secondaryAction: { label: 'Open Me', shortLabel: 'Me', href: '/profile' },
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
