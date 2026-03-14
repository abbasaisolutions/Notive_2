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

export const primaryNavItems: NavItem[] = [
    { href: '/dashboard', label: 'Dashboard', shortLabel: 'Home', icon: icons.home, matchPrefixes: ['/dashboard'] },
    { href: '/entry/new', label: 'New Entry', shortLabel: 'Write', icon: icons.write, isMain: true, matchPrefixes: ['/entry/new', '/entry/edit'] },
    { href: '/timeline', label: 'Timeline', shortLabel: 'Timeline', icon: icons.journey, matchPrefixes: ['/timeline'] },
    { href: '/insights', label: 'Insights', shortLabel: 'Insights', icon: icons.insights, matchPrefixes: ['/insights'] },
];

export const secondaryNavItems: NavItem[] = [
    { href: '/chapters', label: 'Collections', shortLabel: 'Collections', icon: icons.chapters, matchPrefixes: ['/chapters'] },
    { href: '/import', label: 'Imports', shortLabel: 'Imports', icon: icons.imports, matchPrefixes: ['/import'] },
    { href: '/chat', label: 'AI Coach', shortLabel: 'Coach', icon: icons.chat, matchPrefixes: ['/chat'] },
    { href: '/portfolio', label: 'Portfolio', shortLabel: 'Portfolio', icon: icons.legacy, matchPrefixes: ['/portfolio', '/legacy'] },
    { href: '/profile', label: 'Profile', shortLabel: 'Profile', icon: icons.profile, matchPrefixes: ['/profile'] },
    { href: '/admin', label: 'Admin', shortLabel: 'Admin', icon: icons.admin, matchPrefixes: ['/admin'], allowedRoles: ['ADMIN', 'SUPERADMIN'] },
];

export const desktopNavSections: NavSection[] = [
    { id: 'capture', label: 'Capture', items: primaryNavItems },
    { id: 'organize', label: 'Organize', items: secondaryNavItems },
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
        label: 'Organize',
        items: secondaryNavItems.filter((item) => item.href === '/chapters' || item.href === '/import' || item.href === '/portfolio'),
    },
    {
        id: 'tools',
        label: 'Tools',
        items: secondaryNavItems.filter((item) => item.href === '/chat'),
    },
    {
        id: 'account',
        label: 'Account',
        items: secondaryNavItems.filter((item) => item.href === '/profile' || item.href === '/admin'),
    },
];

export const utilityActions: RouteAction[] = [
    { label: 'Quick Write', shortLabel: 'Write', href: '/entry/new?mode=quick' },
    { label: 'AI Coach', shortLabel: 'Coach', href: '/chat' },
    { label: 'Edit Profile', shortLabel: 'Profile', href: '/profile/edit' },
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
        shortLabel: 'Profile',
        href: '/profile/edit',
    };
};

export const journeyStages: JourneyStage[] = [
    { id: 'capture', label: 'Capture', description: 'Document meaningful moments.', href: '/entry/new' },
    { id: 'organize', label: 'Organize', description: 'Group moments into reusable collections.', href: '/chapters' },
    { id: 'reflect', label: 'Reflect', description: 'Read trends and patterns.', href: '/insights' },
    { id: 'apply', label: 'Apply', description: 'Turn growth into outcomes.', href: '/portfolio' },
    { id: 'account', label: 'Account', description: 'Manage identity and settings.', href: '/profile' },
];

const routeMetaByPrefix: Array<{ prefix: string; meta: RouteMeta }> = [
    {
        prefix: '/dashboard',
        meta: {
            title: 'Dashboard',
            description: 'Your launch point for momentum and next actions.',
            section: 'Capture',
            breadcrumbs: [{ label: 'Home', href: '/dashboard' }, { label: 'Dashboard' }],
            primaryAction: { label: 'Write New Entry', shortLabel: 'New Entry', href: '/entry/new' },
            secondaryAction: { label: 'Open Timeline', shortLabel: 'Timeline', href: '/timeline' },
            visibleInfo: ['Recent entries', 'Current streak', 'Next action'],
            journeyStage: 'capture',
        },
    },
    {
        prefix: '/timeline',
        meta: {
            title: 'Timeline',
            description: 'Review your story chronologically and spot key moments.',
            section: 'Capture',
            breadcrumbs: [{ label: 'Home', href: '/dashboard' }, { label: 'Timeline' }],
            primaryAction: { label: 'Quick Capture', shortLabel: 'Quick Capture', href: '/entry/new?mode=quick' },
            secondaryAction: { label: 'View Collections', shortLabel: 'Collections', href: '/chapters' },
            visibleInfo: ['Chronological feed', 'Filters', 'Linked events'],
            journeyStage: 'capture',
        },
    },
    {
        prefix: '/entry/view',
        meta: {
            title: 'Entry Detail',
            description: 'Review an entry with mood, context, and related growth signals.',
            section: 'Capture',
            breadcrumbs: [{ label: 'Home', href: '/dashboard' }, { label: 'Timeline', href: '/timeline' }, { label: 'Entry' }],
            primaryAction: { label: 'Capture New Moment', shortLabel: 'New Entry', href: '/entry/new' },
            secondaryAction: { label: 'Open Timeline', shortLabel: 'Timeline', href: '/timeline' },
            visibleInfo: ['Entry narrative', 'Mood context', 'Related insights'],
            journeyStage: 'capture',
        },
    },
    {
        prefix: '/insights',
        meta: {
            title: 'Insights',
            description: 'See patterns in mood, behavior, and growth signals.',
            section: 'Reflect',
            breadcrumbs: [{ label: 'Home', href: '/dashboard' }, { label: 'Insights' }],
            primaryAction: { label: 'Add Reflection', shortLabel: 'Reflect', href: '/entry/new' },
            secondaryAction: { label: 'Open Portfolio', shortLabel: 'Portfolio', href: '/portfolio' },
            visibleInfo: ['Trend cards', 'Pattern summary', 'Suggested follow-ups'],
            journeyStage: 'reflect',
        },
    },
    {
        prefix: '/chapters',
        meta: {
            title: 'Collections',
            description: 'Organize entries into life collections for faster retrieval and reuse.',
            section: 'Organize',
            breadcrumbs: [{ label: 'Home', href: '/dashboard' }, { label: 'Collections' }],
            primaryAction: { label: 'Capture Entry', shortLabel: 'New Entry', href: '/entry/new' },
            secondaryAction: { label: 'Open Timeline', shortLabel: 'Timeline', href: '/timeline' },
            visibleInfo: ['Theme groups', 'Entry counts', 'Organization controls'],
            journeyStage: 'organize',
        },
    },
    {
        prefix: '/import',
        meta: {
            title: 'Import Inbox',
            description: 'Connect external memories, review source health, and route imports into stronger evidence.',
            section: 'Organize',
            breadcrumbs: [{ label: 'Home', href: '/dashboard' }, { label: 'Import Inbox' }],
            primaryAction: { label: 'Open Timeline', shortLabel: 'Timeline', href: '/timeline' },
            secondaryAction: { label: 'Open Portfolio', shortLabel: 'Portfolio', href: '/portfolio?view=evidence' },
            visibleInfo: ['Connected providers', 'Import queue', 'Evidence pathways'],
            journeyStage: 'organize',
        },
    },
    {
        prefix: '/chat',
        meta: {
            title: 'AI Coach',
            description: 'Use guided prompts to reflect and plan next steps.',
            section: 'Reflect',
            breadcrumbs: [{ label: 'Home', href: '/dashboard' }, { label: 'AI Coach' }],
            primaryAction: { label: 'Open Latest Entry', shortLabel: 'Timeline', href: '/timeline' },
            secondaryAction: { label: 'Write New Entry', shortLabel: 'New Entry', href: '/entry/new' },
            visibleInfo: ['Conversation thread', 'Prompt suggestions', 'Action guidance'],
            journeyStage: 'reflect',
        },
    },
    {
        prefix: '/portfolio',
        meta: {
            title: 'Portfolio',
            description: 'Turn lived experiences into evidence and outcome-ready stories.',
            section: 'Apply',
            breadcrumbs: [{ label: 'Home', href: '/dashboard' }, { label: 'Portfolio' }],
            primaryAction: { label: 'Capture New Evidence', shortLabel: 'New Entry', href: '/entry/new' },
            secondaryAction: { label: 'Strengthen Profile', shortLabel: 'Profile', href: '/profile/edit' },
            visibleInfo: ['Opportunity map', 'Evidence trends', 'Export artifacts'],
            journeyStage: 'apply',
        },
    },
    {
        prefix: '/legacy',
        meta: {
            title: 'Portfolio',
            description: 'Turn lived experiences into evidence and outcome-ready stories.',
            section: 'Apply',
            breadcrumbs: [{ label: 'Home', href: '/dashboard' }, { label: 'Portfolio' }],
            primaryAction: { label: 'Open Portfolio', shortLabel: 'Portfolio', href: '/portfolio' },
            secondaryAction: { label: 'Write New Entry', shortLabel: 'New Entry', href: '/entry/new' },
            visibleInfo: ['Legacy map', 'Story evidence', 'Outcome highlights'],
            journeyStage: 'apply',
        },
    },
    {
        prefix: '/profile',
        meta: {
            title: 'Profile',
            description: 'Use your account hub and settings studio for identity, privacy, and security.',
            section: 'Account',
            breadcrumbs: [{ label: 'Home', href: '/dashboard' }, { label: 'Profile' }],
            primaryAction: { label: 'Edit Profile', shortLabel: 'Edit', href: '/profile/edit' },
            secondaryAction: { label: 'Privacy & Data', shortLabel: 'Privacy', href: '/profile/edit?tab=privacy' },
            visibleInfo: ['Identity basics', 'Growth foundation', 'Privacy controls'],
            journeyStage: 'account',
        },
    },
    {
        prefix: '/admin',
        meta: {
            title: 'Admin',
            description: 'Monitor user health and operations with actionable filters.',
            section: 'Account',
            breadcrumbs: [{ label: 'Home', href: '/dashboard' }, { label: 'Admin' }],
            primaryAction: { label: 'Review Users', shortLabel: 'Review', href: '/admin' },
            secondaryAction: { label: 'Open Profile', shortLabel: 'Profile', href: '/profile' },
            visibleInfo: ['User filters', 'Risk segments', 'Moderation controls'],
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
