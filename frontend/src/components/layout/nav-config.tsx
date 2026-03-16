'use client';

import React from 'react';
import {
    FiBookOpen,
    FiBriefcase,
    FiClock,
    FiHome,
    FiMessageSquare,
    FiPlus,
    FiShield,
    FiTrendingUp,
    FiUploadCloud,
    FiUser,
} from 'react-icons/fi';
import { NOTIVE_VOICE } from '@/content/notive-voice';

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
    journey: <FiClock aria-hidden="true" />,
    insights: <FiTrendingUp aria-hidden="true" />,
    profile: <FiUser aria-hidden="true" />,
    chapters: <FiBookOpen aria-hidden="true" />,
    chat: <FiMessageSquare aria-hidden="true" />,
    legacy: <FiBriefcase aria-hidden="true" />,
    imports: <FiUploadCloud aria-hidden="true" />,
    admin: <FiShield aria-hidden="true" />,
};

const surfaces = NOTIVE_VOICE.surfaces;

export const primaryNavItems: NavItem[] = [
    { href: '/dashboard', label: surfaces.homeBase, shortLabel: 'Home', icon: icons.home, matchPrefixes: ['/dashboard'] },
    { href: '/entry/new', label: 'Write', shortLabel: 'Write', icon: icons.write, isMain: true, matchPrefixes: ['/entry/new', '/entry/edit'] },
    { href: '/timeline', label: surfaces.memoryAtlas, shortLabel: 'Memories', icon: icons.journey, matchPrefixes: ['/timeline'] },
    { href: '/insights', label: surfaces.signalStudio, shortLabel: 'Patterns', icon: icons.insights, matchPrefixes: ['/insights'] },
];

export const secondaryNavItems: NavItem[] = [
    { href: '/chapters', label: surfaces.storyCollections, shortLabel: 'Groups', icon: icons.chapters, matchPrefixes: ['/chapters'] },
    { href: '/import', label: surfaces.memoryInbox, shortLabel: 'Bring In', icon: icons.imports, matchPrefixes: ['/import'] },
    { href: '/chat', label: surfaces.reflectionCoach, shortLabel: 'Guide', icon: icons.chat, matchPrefixes: ['/chat'] },
    { href: '/portfolio', label: surfaces.outcomeStudio, shortLabel: 'Stories', icon: icons.legacy, matchPrefixes: ['/portfolio', '/legacy'] },
    { href: '/profile', label: surfaces.profileStudio, shortLabel: 'Me', icon: icons.profile, matchPrefixes: ['/profile'] },
    { href: '/admin', label: surfaces.admin, shortLabel: 'Manage', icon: icons.admin, matchPrefixes: ['/admin'], allowedRoles: ['ADMIN', 'SUPERADMIN'] },
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
        id: 'tools',
        label: 'Help',
        items: secondaryNavItems.filter((item) => item.href === '/chat'),
    },
    {
        id: 'account',
        label: 'Account',
        items: secondaryNavItems.filter((item) => item.href === '/profile' || item.href === '/admin'),
    },
];

export const utilityActions: RouteAction[] = [
    { label: 'Write', shortLabel: 'Write', href: '/entry/new?mode=quick' },
    { label: surfaces.reflectionCoach, shortLabel: 'Guide', href: '/chat' },
    { label: 'Open Me', shortLabel: 'Me', href: '/profile/edit' },
];

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
    { id: 'reflect', label: 'Patterns', description: 'See feelings, habits, and repeated topics.', href: '/insights' },
    { id: 'apply', label: 'Stories', description: 'Turn moments into clear stories you can use later.', href: '/portfolio' },
    { id: 'account', label: 'Me', description: 'Choose your goals, settings, and privacy.', href: '/profile' },
];

const routeMetaByPrefix: Array<{ prefix: string; meta: RouteMeta }> = [
    {
        prefix: '/dashboard',
        meta: {
            title: surfaces.homeBase,
            description: 'Your main place to write, return to old notes, and pick your next step.',
            section: 'Main',
            breadcrumbs: [{ label: 'Home', href: '/dashboard' }, { label: surfaces.homeBase }],
            primaryAction: { label: 'Write', shortLabel: 'Write', href: '/entry/new' },
            secondaryAction: { label: `Open ${surfaces.memoryAtlas}`, shortLabel: 'Memories', href: '/timeline' },
            visibleInfo: ['Recent notes', 'Days in a row', 'Next step'],
            journeyStage: 'capture',
        },
    },
    {
        prefix: '/timeline',
        meta: {
            title: surfaces.memoryAtlas,
            description: 'Look back at your notes in order and find old moments again.',
            section: 'Main',
            breadcrumbs: [{ label: 'Home', href: '/dashboard' }, { label: surfaces.memoryAtlas }],
            primaryAction: { label: 'Write', shortLabel: 'Write', href: '/entry/new?mode=quick' },
            secondaryAction: { label: `Open ${surfaces.storyCollections}`, shortLabel: 'Groups', href: '/chapters' },
            visibleInfo: ['Dates', 'Search', 'Topics'],
            journeyStage: 'capture',
        },
    },
    {
        prefix: '/entry/view',
        meta: {
            title: 'Note',
            description: 'Read one note with its feeling, tags, and details.',
            section: 'Main',
            breadcrumbs: [{ label: 'Home', href: '/dashboard' }, { label: surfaces.memoryAtlas, href: '/timeline' }, { label: 'Note' }],
            primaryAction: { label: 'Write', shortLabel: 'Write', href: '/entry/new' },
            secondaryAction: { label: `Open ${surfaces.memoryAtlas}`, shortLabel: 'Memories', href: '/timeline' },
            visibleInfo: ['Note text', 'Feeling', 'Related notes'],
            journeyStage: 'capture',
        },
    },
    {
        prefix: '/insights',
        meta: {
            title: surfaces.signalStudio,
            description: 'See feelings, habits, and repeated topics across your notes.',
            section: 'Reflect',
            breadcrumbs: [{ label: 'Home', href: '/dashboard' }, { label: surfaces.signalStudio }],
            primaryAction: { label: 'Write', shortLabel: 'Write', href: '/entry/new' },
            secondaryAction: { label: `Open ${surfaces.outcomeStudio}`, shortLabel: 'Stories', href: '/portfolio' },
            visibleInfo: ['Feelings', 'Main topics', 'Next ideas'],
            journeyStage: 'reflect',
        },
    },
    {
        prefix: '/chapters',
        meta: {
            title: surfaces.storyCollections,
            description: 'Put related notes into simple groups by project, season, or part of life.',
            section: 'Organize',
            breadcrumbs: [{ label: 'Home', href: '/dashboard' }, { label: surfaces.storyCollections }],
            primaryAction: { label: 'Write', shortLabel: 'Write', href: '/entry/new' },
            secondaryAction: { label: `Open ${surfaces.memoryAtlas}`, shortLabel: 'Memories', href: '/timeline' },
            visibleInfo: ['Groups', 'Note counts', 'Topics'],
            journeyStage: 'organize',
        },
    },
    {
        prefix: '/import',
        meta: {
            title: surfaces.memoryInbox,
            description: 'Add old posts, notes, and files so they can become useful stories.',
            section: 'Organize',
            breadcrumbs: [{ label: 'Home', href: '/dashboard' }, { label: surfaces.memoryInbox }],
            primaryAction: { label: `Open ${surfaces.memoryAtlas}`, shortLabel: 'Memories', href: '/timeline' },
            secondaryAction: { label: `Open ${surfaces.outcomeStudio}`, shortLabel: 'Stories', href: '/portfolio?view=evidence' },
            visibleInfo: ['Connected apps', 'Import queue', 'Ready items'],
            journeyStage: 'organize',
        },
    },
    {
        prefix: '/chat',
        meta: {
            title: surfaces.reflectionCoach,
            description: 'Ask Notive for help thinking, remembering, or writing your next note.',
            section: 'Reflect',
            breadcrumbs: [{ label: 'Home', href: '/dashboard' }, { label: surfaces.reflectionCoach }],
            primaryAction: { label: `Open ${surfaces.memoryAtlas}`, shortLabel: 'Memories', href: '/timeline' },
            secondaryAction: { label: 'Write', shortLabel: 'Write', href: '/entry/new' },
            visibleInfo: ['Chat', 'Ideas', 'Next step'],
            journeyStage: 'reflect',
        },
    },
    {
        prefix: '/portfolio',
        meta: {
            title: surfaces.outcomeStudio,
            description: 'Turn lived moments into clear stories for school, work, and growth.',
            section: 'Apply',
            breadcrumbs: [{ label: 'Home', href: '/dashboard' }, { label: surfaces.outcomeStudio }],
            primaryAction: { label: 'Write', shortLabel: 'Write', href: '/entry/new' },
            secondaryAction: { label: `Open ${surfaces.profileStudio}`, shortLabel: 'Me', href: '/profile/edit' },
            visibleInfo: ['Story quality', 'Practice', 'Exports'],
            journeyStage: 'apply',
        },
    },
    {
        prefix: '/legacy',
        meta: {
            title: surfaces.outcomeStudio,
            description: 'Turn lived moments into clear stories you can use later.',
            section: 'Apply',
            breadcrumbs: [{ label: 'Home', href: '/dashboard' }, { label: surfaces.outcomeStudio }],
            primaryAction: { label: `Open ${surfaces.outcomeStudio}`, shortLabel: 'Stories', href: '/portfolio' },
            secondaryAction: { label: 'Write', shortLabel: 'Write', href: '/entry/new' },
            visibleInfo: ['Old view', 'Story details', 'Highlights'],
            journeyStage: 'apply',
        },
    },
    {
        prefix: '/profile',
        meta: {
            title: surfaces.profileStudio,
            description: 'Your profile, goals, settings, and privacy.',
            section: 'Account',
            breadcrumbs: [{ label: 'Home', href: '/dashboard' }, { label: surfaces.profileStudio }],
            primaryAction: { label: 'Edit Me', shortLabel: 'Edit', href: '/profile/edit' },
            secondaryAction: { label: 'Privacy & Data', shortLabel: 'Privacy', href: '/profile/edit?tab=privacy' },
            visibleInfo: ['Goals', 'Settings', 'Privacy'],
            journeyStage: 'account',
        },
    },
    {
        prefix: '/admin',
        meta: {
            title: surfaces.admin,
            description: 'Support users and manage accounts.',
            section: 'Account',
            breadcrumbs: [{ label: 'Home', href: '/dashboard' }, { label: surfaces.admin }],
            primaryAction: { label: 'Review Users', shortLabel: 'Review', href: '/admin' },
            secondaryAction: { label: `Open ${surfaces.profileStudio}`, shortLabel: 'Me', href: '/profile' },
            visibleInfo: ['Users', 'Support', 'Safety'],
            journeyStage: 'account',
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
