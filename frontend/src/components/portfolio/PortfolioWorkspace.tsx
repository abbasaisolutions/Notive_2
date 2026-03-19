'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { IconType } from 'react-icons';
import {
    FiArrowRight,
    FiBookOpen,
    FiCheckCircle,
    FiChevronLeft,
    FiChevronRight,
    FiClock,
    FiDownload,
    FiEdit2,
    FiEye,
    FiFileText,
    FiFlag,
    FiGrid,
    FiMessageSquare,
    FiPrinter,
    FiTool,
    FiTrendingUp,
    FiUploadCloud,
    FiX,
    FiZap,
} from 'react-icons/fi';
import { ActionBar, AppPanel, EmptyState, SectionHeader, StatTile, TagPill } from '@/components/ui/surface';
import { API_URL } from '@/constants/config';
import useApi from '@/hooks/use-api';
import useAuthRedirect from '@/hooks/use-auth-redirect';
import useTelemetry from '@/hooks/use-telemetry';
import { appendReturnTo, buildCurrentReturnTo } from '@/utils/navigation';
import {
    buildRecentViews,
    readPortfolioSession,
    resolvePortfolioEvidenceFilter,
    resolvePortfolioExportType,
    resolvePortfolioView,
    type PortfolioSessionState,
    type PortfolioView,
    writePortfolioSession,
} from '@/utils/portfolio-session';
import { writeWorkspaceResume } from '@/utils/workspace-resume';

type StatementVariant = 'standard' | 'college' | 'entry_job';
type ExportType = 'resume' | 'statement' | 'interview' | 'growth';
type DocumentExportType = 'resume' | 'statement';
type ExportDownloadFormat = 'html' | 'markdown';
type EvidenceField = 'situation' | 'action' | 'lesson' | 'outcome' | 'skills';
type EvidenceFilter = 'all' | 'needs_attention' | 'ready_to_verify' | 'ready_to_export' | 'verified';

type EvidenceCompleteness = {
    score: number;
    presentCount: number;
    totalCount: number;
    missingFields: EvidenceField[];
    readyForVerification: boolean;
    readyForExport: boolean;
};

type Experience = {
    id: string;
    entryId: string;
    createdAt: string;
    title: string;
    situation: string;
    action: string;
    lesson: string;
    outcome: string;
    skills: string[];
    confidence: number;
    verified: boolean;
    verificationNotes: string;
    completeness?: EvidenceCompleteness;
};

type ProfileContext = {
    primaryGoal: string | null;
    focusArea: string | null;
    experienceLevel: string | null;
    writingPreference: string | null;
    lifeGoals: string[];
    outputGoals: string[];
    completionScore: number;
    stage: 'not_started' | 'in_progress' | 'completed';
    track: 'personal' | 'professional' | 'blended' | 'unknown';
    personalGrowthScore: number;
    professionalReadinessScore: number;
};

type Overview = {
    generatedAt: string;
    profileContext: ProfileContext | null;
    stats: { entryCount: number; experienceCount: number; verifiedCount: number };
    topSkills: string[];
    topLessons: string[];
    experiences: Experience[];
    resumeBullets: Array<{ id: string; bullet: string }>;
    interviewStories: Array<{ id: string; entryId: string; title: string; situation: string; task: string; action: string; result: string }>;
    personalStatement: string;
    statementVariants?: Record<StatementVariant, string>;
};

type Trends = {
    period: 'week' | 'month';
    points: Array<{ periodStart: string; periodLabel: string; entries: number; verified: number; averageConfidence: number }>;
    progression: {
        verifiedRateNow: number;
        verifiedRateThen: number;
        confidenceNow: number;
        confidenceThen: number;
        entriesNow: number;
        entriesThen: number;
    };
};

type Draft = {
    title: string;
    situation: string;
    action: string;
    lesson: string;
    outcome: string;
    skillsText: string;
    notes: string;
};

type ExportPreview = {
    type: DocumentExportType;
    fileName: string;
    content: string;
};

type ExperienceMeta = {
    experience: Experience;
    completeness: EvidenceCompleteness;
    state: Exclude<EvidenceFilter, 'all'>;
    createdAtMs: number;
};

const exportTypes: DocumentExportType[] = ['resume', 'statement'];
const evidenceFilters: EvidenceFilter[] = ['all', 'needs_attention', 'ready_to_verify', 'ready_to_export', 'verified'];
const portfolioViews: PortfolioView[] = ['export', 'evidence', 'interview', 'growth'];
const EMPTY_FILTER_COUNTS: Record<EvidenceFilter, number> = {
    all: 0,
    needs_attention: 0,
    ready_to_verify: 0,
    ready_to_export: 0,
    verified: 0,
};
const EXPERIENCE_STATE_RANK: Record<Exclude<EvidenceFilter, 'all'>, number> = {
    needs_attention: 0,
    ready_to_verify: 1,
    ready_to_export: 2,
    verified: 3,
};

const statementVariantLabels: Record<StatementVariant, string> = {
    standard: 'Standard',
    college: 'College',
    entry_job: 'Entry Job',
};

const exportTypeLabels: Record<ExportType, string> = {
    resume: 'Resume',
    statement: 'Statement',
    interview: 'Interview',
    growth: 'Growth',
};

const exportTypeDescriptions: Record<ExportType, string> = {
    resume: 'Bullet points and short story fragments you can reuse for resumes, school, and applications.',
    statement: 'A narrative draft that turns lived moments into direction, identity, and voice.',
    interview: 'A focused STAR-style workspace for previewing and rehearsing your stories.',
    growth: 'A progress view with repeated strengths, proof, and what to strengthen next.',
};

const exportTypeIcons: Record<ExportType, IconType> = {
    resume: FiFileText,
    statement: FiBookOpen,
    interview: FiMessageSquare,
    growth: FiTrendingUp,
};

const evidenceFilterLabels: Record<EvidenceFilter, string> = {
    all: 'All Stories',
    needs_attention: 'Needs More Detail',
    ready_to_verify: 'Ready to Check',
    ready_to_export: 'Ready to Use',
    verified: 'Checked',
};

const portfolioViewLabels: Record<PortfolioView, string> = {
    export: 'Resume & Statement',
    evidence: 'Evidence',
    interview: 'Interview',
    growth: 'Progress',
};

const portfolioViewIcons: Record<PortfolioView, IconType> = {
    export: FiDownload,
    evidence: FiGrid,
    interview: FiMessageSquare,
    growth: FiTrendingUp,
};

const EVIDENCE_FIELD_LABELS: Record<EvidenceField, string> = {
    situation: 'Situation',
    action: 'Action',
    lesson: 'Lesson',
    outcome: 'Result',
    skills: 'Skills',
};

const hasValue = (value: string | null | undefined): value is string => typeof value === 'string' && value.trim().length > 0;

const parseSkillsInput = (skillsText: string) =>
    skillsText.split(/[\n,]/g).map((value) => value.trim()).filter(Boolean).slice(0, 10);

const formatLabel = (value: string | null | undefined, fallback = 'Not set') => {
    if (!value) return fallback;
    return value
        .split(/[_-\s]+/g)
        .filter(Boolean)
        .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
        .join(' ');
};

const formatShortDate = (value: string) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatLongDateTime = (value: string) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' });
};

const formatRelativeTime = (value: string) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'Recently';

    const deltaMs = Date.now() - parsed.getTime();
    const deltaMinutes = Math.max(Math.round(deltaMs / 60000), 0);
    if (deltaMinutes < 1) return 'Just now';
    if (deltaMinutes < 60) return `${deltaMinutes}m ago`;

    const deltaHours = Math.round(deltaMinutes / 60);
    if (deltaHours < 24) return `${deltaHours}h ago`;

    const deltaDays = Math.round(deltaHours / 24);
    if (deltaDays < 7) return `${deltaDays}d ago`;
    return formatShortDate(value);
};

const formatRatioPercent = (value: number) => `${Math.round(value * 100)}%`;
const normalizeDocumentExportType = (value: ExportType | null | undefined): DocumentExportType => value === 'statement' ? 'statement' : 'resume';

const parseExportFileName = (contentDisposition: string | null, fallback: string) => {
    if (!contentDisposition) return fallback;

    const utfMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (utfMatch?.[1]) return decodeURIComponent(utfMatch[1]);

    const match = contentDisposition.match(/filename=\"?([^\";]+)\"?/i);
    return match?.[1] || fallback;
};

const triggerDownload = (fileName: string, content: string, contentType: string) => {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(link);
};

const computeEvidenceCompleteness = (input: {
    situation: string;
    action: string;
    lesson: string;
    outcome: string;
    skills: string[];
}): EvidenceCompleteness => {
    const presence: Record<EvidenceField, boolean> = {
        situation: hasValue(input.situation),
        action: hasValue(input.action),
        lesson: hasValue(input.lesson),
        outcome: hasValue(input.outcome),
        skills: Array.isArray(input.skills) && input.skills.length > 0,
    };

    const missingFields = (Object.keys(presence) as EvidenceField[]).filter((field) => !presence[field]);
    const totalCount = Object.keys(presence).length;
    const presentCount = totalCount - missingFields.length;

    return {
        score: Math.round((presentCount / totalCount) * 100),
        presentCount,
        totalCount,
        missingFields,
        readyForVerification: presence.situation && presence.action && presence.lesson && presence.outcome,
        readyForExport: presence.situation && presence.action && presence.lesson && presence.outcome && presence.skills,
    };
};

const getExperienceCompleteness = (experience: Experience): EvidenceCompleteness =>
    experience.completeness || computeEvidenceCompleteness({
        situation: experience.situation,
        action: experience.action,
        lesson: experience.lesson,
        outcome: experience.outcome,
        skills: experience.skills || [],
    });

const getDraftCompleteness = (draft: Draft): EvidenceCompleteness =>
    computeEvidenceCompleteness({
        situation: draft.situation,
        action: draft.action,
        lesson: draft.lesson,
        outcome: draft.outcome,
        skills: parseSkillsInput(draft.skillsText),
    });

const getExperienceMeta = (experience: Experience): ExperienceMeta => {
    const completeness = getExperienceCompleteness(experience);
    const state = experience.verified
        ? 'verified'
        : completeness.readyForExport
            ? 'ready_to_export'
            : completeness.readyForVerification
                ? 'ready_to_verify'
                : 'needs_attention';

    return {
        experience,
        completeness,
        state,
        createdAtMs: Date.parse(experience.createdAt) || 0,
    };
};

const getRecommendedExportType = (overview: Overview | null): DocumentExportType => {
    if (!overview) return 'resume';

    const outputGoals = overview.profileContext?.outputGoals.map((goal) => goal.toLowerCase()) || [];
    let hasCollegeGoal = false;
    let hasResumeGoal = false;

    outputGoals.forEach((goal) => {
        if (goal.includes('college')) hasCollegeGoal = true;
        if (goal.includes('resume') || goal.includes('portfolio')) hasResumeGoal = true;
    });

    if (hasCollegeGoal) return 'statement';
    if (hasResumeGoal) return 'resume';
    if (overview.resumeBullets.length > 0) return 'resume';
    return hasValue(overview.personalStatement) ? 'statement' : 'resume';
};

const getRecommendedPortfolioView = (
    overview: Overview | null,
    counts: Record<EvidenceFilter, number>
): PortfolioView => {
    if (!overview) return 'export';
    if (counts.needs_attention > 0 || counts.ready_to_verify > 0) return 'evidence';

    const outputGoals = overview.profileContext?.outputGoals.map((goal) => goal.toLowerCase()) || [];
    let prefersInterview = false;
    let prefersExport = false;

    outputGoals.forEach((goal) => {
        if (goal.includes('interview')) prefersInterview = true;
        if (goal.includes('resume') || goal.includes('portfolio') || goal.includes('college')) {
            prefersExport = true;
        }
    });

    if (prefersInterview) return 'interview';
    if (prefersExport) {
        return 'export';
    }

    return 'growth';
};

const buildResumeLabel = (session: PortfolioSessionState) => {
    if (session.view === 'export') {
        return exportTypeLabels[session.selectedExportType];
    }

    if (session.view === 'evidence') {
        return `${portfolioViewLabels.evidence} · ${evidenceFilterLabels[session.evidenceFilter]}`;
    }

    if (session.view === 'interview') {
        return `${portfolioViewLabels.interview} · Guided rehearsal`;
    }

    return `${portfolioViewLabels.growth} · Progress view`;
};

export default function PortfolioWorkspace() {
    const pathname = usePathname();
    const { isLoading: authLoading, isAuthenticated } = useAuthRedirect();
    const { apiFetch } = useApi();
    const { trackEvent } = useTelemetry();
    const reduceMotion = useReducedMotion();
    const previewRequestRef = useRef(0);
    const hasHydratedWorkspaceRef = useRef(false);
    const resumeSessionRef = useRef<PortfolioSessionState | null>(null);

    const [overview, setOverview] = useState<Overview | null>(null);
    const [trends, setTrends] = useState<Trends | null>(null);
    const [trendPeriod, setTrendPeriod] = useState<'week' | 'month'>('month');
    const [statementVariant, setStatementVariant] = useState<StatementVariant>('standard');
    const [selectedExportType, setSelectedExportType] = useState<DocumentExportType>('resume');
    const [activeView, setActiveView] = useState<PortfolioView>('export');
    const [activeStoryEntryId, setActiveStoryEntryId] = useState<string | null>(null);
    const [practiceMode, setPracticeMode] = useState(false);
    const [practiceReveal, setPracticeReveal] = useState(false);
    const [evidenceFilter, setEvidenceFilter] = useState<EvidenceFilter>('all');
    const [recentViews, setRecentViews] = useState<PortfolioView[]>([]);
    const [resumeSession, setResumeSession] = useState<PortfolioSessionState | null>(null);
    const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
    const [drafts, setDrafts] = useState<Record<string, Draft>>({});
    const [exportPreview, setExportPreview] = useState<ExportPreview | null>(null);
    const [isPreviewLoading, setIsPreviewLoading] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [previewError, setPreviewError] = useState('');
    const [savingEntryId, setSavingEntryId] = useState<string | null>(null);
    const [updatingEntryId, setUpdatingEntryId] = useState<string | null>(null);
    const [downloadingKey, setDownloadingKey] = useState<string | null>(null);
    const [hasSeededExportType, setHasSeededExportType] = useState(false);

    const currentReturnTo = useMemo(() => buildCurrentReturnTo(pathname, `?view=${activeView}`), [activeView, pathname]);
    const captureHref = appendReturnTo('/entry/new?mode=quick', currentReturnTo);
    const profileHref = appendReturnTo('/profile/edit?tab=preferences', currentReturnTo);

    const fetchOverview = useCallback(async () => {
        if (!isAuthenticated) return;
        setIsLoading(true);
        setError('');

        try {
            const response = await apiFetch(`${API_URL}/ai/opportunity/overview`);
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Failed to load portfolio');
            setOverview(data.overview as Overview);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to load portfolio');
        } finally {
            setIsLoading(false);
        }
    }, [apiFetch, isAuthenticated]);

    const fetchTrends = useCallback(async (period: 'week' | 'month') => {
        if (!isAuthenticated) return;

        try {
            const response = await apiFetch(`${API_URL}/ai/opportunity/trends?period=${period}&window=6`);
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Failed to load trends');
            setTrends(data.trends as Trends);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to load trends');
        }
    }, [apiFetch, isAuthenticated]);

    useEffect(() => {
        if (!isAuthenticated) return;
        fetchOverview();
    }, [fetchOverview, isAuthenticated]);

    useEffect(() => {
        if (!isAuthenticated) return;
        fetchTrends(trendPeriod);
    }, [fetchTrends, isAuthenticated, trendPeriod]);

    const buildExportUrl = useCallback((type: DocumentExportType, format: ExportDownloadFormat) => (
        `${API_URL}/ai/opportunity/export?type=${type}&format=${format}&variant=${statementVariant}`
    ), [statementVariant]);

    const syncViewInUrl = useCallback((view: PortfolioView, historyMode: 'push' | 'replace' = 'push') => {
        if (typeof window === 'undefined') return;
        const nextUrl = new URL(window.location.href);
        nextUrl.searchParams.set('view', view);
        window.history[historyMode === 'push' ? 'pushState' : 'replaceState']({}, '', nextUrl.toString());
    }, []);

    const switchView = useCallback((view: PortfolioView, historyMode: 'push' | 'replace' = 'push') => {
        setActiveView(view);
        setPracticeReveal(false);
        syncViewInUrl(view, historyMode);
    }, [syncViewInUrl]);

    const requestExportDocument = useCallback(async (type: DocumentExportType, format: ExportDownloadFormat) => {
        const response = await apiFetch(buildExportUrl(type, format));
        if (!response.ok) throw new Error(`Failed to load ${format} export`);

        const content = await response.text();
        const fallbackName = `notive-${type}.${format === 'html' ? 'html' : 'md'}`;

        return {
            fileName: parseExportFileName(response.headers.get('content-disposition'), fallbackName),
            content,
        };
    }, [apiFetch, buildExportUrl]);

    const loadExportPreview = useCallback(async (type: DocumentExportType) => {
        setSelectedExportType(type);
        setIsPreviewLoading(true);
        setPreviewError('');
        const requestId = ++previewRequestRef.current;

        try {
            const { fileName, content } = await requestExportDocument(type, 'html');
            if (requestId !== previewRequestRef.current) return;

            setExportPreview({
                type,
                fileName,
                content,
            });
        } catch (err: unknown) {
            if (requestId !== previewRequestRef.current) return;
            setPreviewError(err instanceof Error ? err.message : 'Failed to load export preview');
        } finally {
            if (requestId === previewRequestRef.current) {
                setIsPreviewLoading(false);
            }
        }
    }, [requestExportDocument]);

    const downloadExport = useCallback(async (type: DocumentExportType, format: ExportDownloadFormat) => {
        const key = `${type}:${format}`;
        setSelectedExportType(type);
        setDownloadingKey(key);
        setPreviewError('');
        void trackEvent({
            eventType: 'export_started',
            value: `${type}:${format}`,
            metadata: {
                view: activeView,
                statementVariant,
            },
        });

        try {
            if (format === 'html' && exportPreview?.type === type) {
                triggerDownload(exportPreview.fileName, exportPreview.content, 'text/html; charset=utf-8');
                return;
            }

            const { fileName, content } = await requestExportDocument(type, format);
            triggerDownload(
                fileName,
                content,
                format === 'html' ? 'text/html; charset=utf-8' : 'text/markdown; charset=utf-8'
            );

            if (format === 'html') {
                setExportPreview({
                    type,
                    fileName,
                    content,
                });
            }
        } catch (err: unknown) {
            setPreviewError(err instanceof Error ? err.message : 'Failed to export document');
        } finally {
            setDownloadingKey(null);
        }
    }, [activeView, exportPreview, requestExportDocument, statementVariant, trackEvent]);

    const printSelectedExport = useCallback(async () => {
        const printWindow = window.open('', '_blank', 'noopener,noreferrer');
        if (!printWindow) {
            setPreviewError('Pop-up blocked. Allow pop-ups to print the export.');
            return;
        }

        setDownloadingKey(`${selectedExportType}:print`);
        void trackEvent({
            eventType: 'export_started',
            value: `${selectedExportType}:print`,
            metadata: {
                view: activeView,
                statementVariant,
            },
        });
        try {
            const payload = exportPreview?.type === selectedExportType
                ? exportPreview
                : {
                    type: selectedExportType,
                    ...(await requestExportDocument(selectedExportType, 'html')),
                };

            setExportPreview(payload);
            printWindow.document.open();
            printWindow.document.write(payload.content);
            printWindow.document.close();
            printWindow.focus();
            window.setTimeout(() => printWindow.print(), 180);
        } catch (err: unknown) {
            printWindow.close();
            setPreviewError(err instanceof Error ? err.message : 'Failed to prepare print preview');
        } finally {
            setDownloadingKey(null);
        }
    }, [activeView, exportPreview, requestExportDocument, selectedExportType, statementVariant, trackEvent]);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const storedSession = readPortfolioSession();
        resumeSessionRef.current = storedSession;
        setResumeSession(storedSession);

        if (storedSession) {
            setSelectedExportType(normalizeDocumentExportType(storedSession.selectedExportType));
            setStatementVariant(storedSession.statementVariant);
            setEvidenceFilter(storedSession.evidenceFilter);
            setActiveStoryEntryId(storedSession.lastOpenedStoryId);
            setRecentViews(storedSession.recentViews);
        }

        const syncFromUrl = () => {
            const params = new URLSearchParams(window.location.search);
            const nextView = resolvePortfolioView(params.get('view'));
            const nextExportType = resolvePortfolioExportType(params.get('pack'));
            const nextFilter = resolvePortfolioEvidenceFilter(params.get('filter'));
            const nextStoryId = params.get('story');

            if (nextView) {
                setActiveView(nextView);
            }
            if (nextExportType) {
                setSelectedExportType(normalizeDocumentExportType(nextExportType));
                if (nextExportType === 'interview') {
                    setActiveView('interview');
                } else if (nextExportType === 'growth') {
                    setActiveView('growth');
                }
            }
            if (nextFilter) {
                setEvidenceFilter(nextFilter);
            }
            if (nextStoryId) {
                setActiveStoryEntryId(nextStoryId);
            }
        };

        const params = new URLSearchParams(window.location.search);
        const queryView = resolvePortfolioView(params.get('view'));
        const queryExportType = resolvePortfolioExportType(params.get('pack'));
        const queryFilter = resolvePortfolioEvidenceFilter(params.get('filter'));
        const queryStoryId = params.get('story');

        if (queryExportType) {
            setSelectedExportType(normalizeDocumentExportType(queryExportType));
        }
        if (queryFilter) {
            setEvidenceFilter(queryFilter);
        }
        if (queryStoryId) {
            setActiveStoryEntryId(queryStoryId);
        }

        if (queryExportType === 'interview') {
            setActiveView('interview');
        } else if (queryExportType === 'growth') {
            setActiveView('growth');
        } else if (queryView) {
            setActiveView(queryView);
        } else if (storedSession?.view) {
            setActiveView(storedSession.view);
        }

        window.addEventListener('popstate', syncFromUrl);
        return () => window.removeEventListener('popstate', syncFromUrl);
    }, []);

    useEffect(() => {
        if (!overview || hasSeededExportType) return;
        if (resumeSessionRef.current?.selectedExportType) {
            setHasSeededExportType(true);
            return;
        }

        setSelectedExportType(getRecommendedExportType(overview));
        setHasSeededExportType(true);
    }, [hasSeededExportType, overview]);

    const statement = useMemo(() => {
        if (!overview) return '';
        return overview.statementVariants?.[statementVariant] || overview.personalStatement;
    }, [overview, statementVariant]);

    useEffect(() => {
        if (!exportPreview?.type) return;
        loadExportPreview(exportPreview.type);
    }, [exportPreview?.type, loadExportPreview, statementVariant]);

    const {
        evidenceSummary,
        filterCounts,
        experienceByEntryId,
        experienceMetaByEntryId,
        experienceMetas,
        interviewStoryByEntryId,
    } = useMemo(() => {
        if (!overview || overview.experiences.length === 0) {
            return {
                evidenceSummary: { avgScore: 0, readyForVerification: 0, readyForExport: 0, total: 0 },
                filterCounts: { ...EMPTY_FILTER_COUNTS },
                experienceByEntryId: new Map<string, Experience>(),
                experienceMetaByEntryId: new Map<string, ExperienceMeta>(),
                experienceMetas: [] as ExperienceMeta[],
                interviewStoryByEntryId: new Map<string, Overview['interviewStories'][number]>(),
            };
        }

        const nextFilterCounts: Record<EvidenceFilter, number> = { ...EMPTY_FILTER_COUNTS };
        const nextExperienceByEntryId = new Map<string, Experience>();
        const nextExperienceMetaByEntryId = new Map<string, ExperienceMeta>();
        const nextInterviewStoryByEntryId = new Map<string, Overview['interviewStories'][number]>();
        const nextExperienceMetas = overview.experiences.map((experience) => {
            const meta = getExperienceMeta(experience);
            nextFilterCounts.all += 1;
            nextFilterCounts[meta.state] += 1;
            nextExperienceByEntryId.set(experience.entryId, experience);
            nextExperienceMetaByEntryId.set(experience.entryId, meta);
            return meta;
        });

        overview.interviewStories.forEach((story) => {
            nextInterviewStoryByEntryId.set(story.entryId, story);
        });

        const total = nextExperienceMetas.length;
        let scoreTotal = 0;
        let readyForVerification = 0;
        let readyForExport = 0;

        nextExperienceMetas.forEach(({ completeness }) => {
            scoreTotal += completeness.score;
            readyForVerification += completeness.readyForVerification ? 1 : 0;
            readyForExport += completeness.readyForExport ? 1 : 0;
        });

        return {
            evidenceSummary: {
                avgScore: Math.round(scoreTotal / total),
                readyForVerification,
                readyForExport,
                total,
            },
            filterCounts: nextFilterCounts,
            experienceByEntryId: nextExperienceByEntryId,
            experienceMetaByEntryId: nextExperienceMetaByEntryId,
            experienceMetas: nextExperienceMetas,
            interviewStoryByEntryId: nextInterviewStoryByEntryId,
        };
    }, [overview]);

    const recommendedView = useMemo(() => getRecommendedPortfolioView(overview, filterCounts), [filterCounts, overview]);
    const recommendedExportType = useMemo(() => getRecommendedExportType(overview), [overview]);

    useEffect(() => {
        if (!overview || hasHydratedWorkspaceRef.current) return;

        const storedSession = resumeSessionRef.current;
        const queryView = typeof window === 'undefined'
            ? null
            : resolvePortfolioView(new URLSearchParams(window.location.search).get('view'));
        const initialView = queryView || storedSession?.view || recommendedView;

        setActiveView(initialView);
        syncViewInUrl(initialView, 'replace');
        hasHydratedWorkspaceRef.current = true;
    }, [overview, recommendedView, syncViewInUrl]);

    const filteredExperiences = useMemo(() => {
        return [...experienceMetas]
            .filter((meta) => evidenceFilter === 'all' || meta.state === evidenceFilter)
            .sort((left, right) => {
                const stateDiff = EXPERIENCE_STATE_RANK[left.state] - EXPERIENCE_STATE_RANK[right.state];
                if (stateDiff !== 0) return stateDiff;

                const scoreDiff = left.completeness.score - right.completeness.score;
                if (scoreDiff !== 0) return scoreDiff;

                return right.createdAtMs - left.createdAtMs;
            })
            .map((meta) => meta.experience);
    }, [evidenceFilter, experienceMetas]);

    useEffect(() => {
        if (!overview || overview.interviewStories.length === 0) return;
        const hasActiveStory = activeStoryEntryId && overview.interviewStories.some((story) => story.entryId === activeStoryEntryId);
        if (hasActiveStory) return;
        setActiveStoryEntryId(overview.interviewStories[0]?.entryId || null);
    }, [activeStoryEntryId, overview]);

    useEffect(() => {
        setPracticeReveal(false);
    }, [activeStoryEntryId, practiceMode]);

    useEffect(() => {
        if (typeof document === 'undefined') return;
        if (!editingEntryId) return;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [editingEntryId]);

    useEffect(() => {
        if (!overview || activeView !== 'export') return;
        if (exportPreview?.type === selectedExportType) return;
        loadExportPreview(selectedExportType);
    }, [activeView, exportPreview?.type, loadExportPreview, overview, selectedExportType]);

    useEffect(() => {
        if (!hasHydratedWorkspaceRef.current) return;
        setRecentViews((current) => buildRecentViews(activeView, current));
    }, [activeView]);

    useEffect(() => {
        if (!hasHydratedWorkspaceRef.current) return;

        const sessionState: PortfolioSessionState = {
            view: activeView,
            selectedExportType,
            statementVariant,
            evidenceFilter,
            lastOpenedStoryId: activeStoryEntryId,
            recentViews,
            updatedAt: new Date().toISOString(),
        };

        writePortfolioSession(sessionState);
        writeWorkspaceResume({
            key: 'portfolio',
            title: 'Stories',
            summary: buildResumeLabel(sessionState),
            href: currentReturnTo,
            updatedAt: sessionState.updatedAt,
            stage: 'apply',
            actionLabel: 'Resume stories',
        });
    }, [activeStoryEntryId, activeView, currentReturnTo, evidenceFilter, recentViews, selectedExportType, statementVariant]);

    const incompleteEvidenceCount = filterCounts.needs_attention;
    const maxTrendValue = useMemo(() => {
        if (!trends || trends.points.length === 0) return 1;
        return Math.max(...trends.points.map((point) => Math.max(point.entries, point.verified, 1)));
    }, [trends]);

    const activeInterviewStory = useMemo(() => {
        if (!overview || overview.interviewStories.length === 0) return null;
        if (activeStoryEntryId) {
            return interviewStoryByEntryId.get(activeStoryEntryId) || overview.interviewStories[0];
        }
        return overview.interviewStories[0];
    }, [activeStoryEntryId, interviewStoryByEntryId, overview]);

    const activeInterviewExperience = useMemo(() => {
        if (!activeInterviewStory) return null;
        return experienceByEntryId.get(activeInterviewStory.entryId) || null;
    }, [activeInterviewStory, experienceByEntryId]);

    const recentViewLinks = useMemo(() => recentViews.filter((view) => view !== activeView).slice(0, 3), [activeView, recentViews]);

    const nextAction = useMemo(() => {
        if (!overview || overview.experiences.length === 0) {
            return {
                title: 'Capture your first proof point',
                description: 'Start with one quick entry. The portfolio gets better once there is one concrete situation, action, and outcome to work from.',
                actionLabel: 'Start Quick Capture',
                actionHref: captureHref,
                targetView: null as PortfolioView | null,
            };
        }

        if (filterCounts.needs_attention > 0) {
            return {
                title: 'Tighten weak evidence first',
                description: `${filterCounts.needs_attention} experience${filterCounts.needs_attention === 1 ? '' : 's'} are missing core detail. Closing those gaps raises quality across every export format.`,
                actionLabel: 'Review Evidence Queue',
                actionHref: null as string | null,
                targetView: 'evidence' as PortfolioView,
            };
        }

        if (filterCounts.ready_to_verify > 0) {
            return {
                title: 'Verify the strongest stories',
                description: `${filterCounts.ready_to_verify} experience${filterCounts.ready_to_verify === 1 ? '' : 's'} already have enough structure to verify and convert into stronger exports.`,
                actionLabel: 'Verify Stories',
                actionHref: null as string | null,
                targetView: 'evidence' as PortfolioView,
            };
        }

        if (recommendedView === 'interview') {
            return {
                title: 'Open interview practice',
                description: 'Your evidence base is in good shape. Go straight into the interview workspace and rehearse one story at a time.',
                actionLabel: 'Open Interview',
                actionHref: null as string | null,
                targetView: 'interview' as PortfolioView,
            };
        }

        if (recommendedView === 'growth') {
            return {
                title: 'Review growth progress',
                description: 'Your evidence base is stable. Step into growth mode to review momentum, proof, and what should strengthen next.',
                actionLabel: 'Open Growth',
                actionHref: null as string | null,
                targetView: 'growth' as PortfolioView,
            };
        }

        return {
            title: `Open ${exportTypeLabels[recommendedExportType]}`,
            description: 'Your evidence base is in good shape. Open the document workspace and tailor the output to the audience you need right now.',
            actionLabel: `Open ${exportTypeLabels[recommendedExportType]}`,
            actionHref: null as string | null,
            targetView: 'export' as PortfolioView,
        };
    }, [captureHref, filterCounts.needs_attention, filterCounts.ready_to_verify, overview, recommendedExportType, recommendedView]);

    const pathwayCards = useMemo(() => {
        if (!overview) return [];

        return exportTypes.map((type) => {
            const Icon = exportTypeIcons[type];
            const isRecommended = type === recommendedExportType;

            const readiness =
                type === 'resume'
                    ? `${overview.resumeBullets.length} bullet${overview.resumeBullets.length === 1 ? '' : 's'} ready`
                    : hasValue(statement)
                        ? 'Draft ready to refine'
                        : 'Needs more profile direction';

            const secondary =
                type === 'resume'
                    ? `${filterCounts.ready_to_export} experience${filterCounts.ready_to_export === 1 ? '' : 's'} ready to export`
                    : overview.profileContext?.track
                        ? `${formatLabel(overview.profileContext.track)} track`
                        : 'Use your strongest verified story';

            return {
                type,
                Icon,
                title: exportTypeLabels[type],
                description: exportTypeDescriptions[type],
                readiness,
                secondary,
                isRecommended,
            };
        });
    }, [evidenceSummary.avgScore, filterCounts.ready_to_export, filterCounts.verified, overview, recommendedExportType, statement]);
    const selectedPathwayCard = useMemo(
        () => pathwayCards.find((card) => card.type === selectedExportType) || pathwayCards[0] || null,
        [pathwayCards, selectedExportType]
    );

    const startEdit = (experience: Experience) => {
        setEditingEntryId(experience.entryId);
        setDrafts((prev) => ({
            ...prev,
            [experience.entryId]: {
                title: experience.title,
                situation: experience.situation,
                action: experience.action,
                lesson: experience.lesson,
                outcome: experience.outcome,
                skillsText: experience.skills.join(', '),
                notes: experience.verificationNotes || '',
            },
        }));
    };

    const updateDraft = (entryId: string, field: keyof Draft, value: string) => {
        setDrafts((prev) => ({ ...prev, [entryId]: { ...prev[entryId], [field]: value } }));
    };

    const saveDraft = async (entryId: string) => {
        const draft = drafts[entryId];
        if (!draft) return;

        setSavingEntryId(entryId);
        setError('');

        try {
            const response = await apiFetch(`${API_URL}/ai/opportunity/entry/${entryId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: draft.title,
                    situation: draft.situation,
                    action: draft.action,
                    lesson: draft.lesson,
                    outcome: draft.outcome,
                    notes: draft.notes,
                    skills: parseSkillsInput(draft.skillsText),
                }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Failed to save experience');

            setEditingEntryId(null);
            await Promise.all([fetchOverview(), fetchTrends(trendPeriod)]);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to save experience');
        } finally {
            setSavingEntryId(null);
        }
    };

    const toggleVerified = async (experience: Experience) => {
        setUpdatingEntryId(experience.entryId);
        setError('');

        try {
            const response = await apiFetch(`${API_URL}/ai/opportunity/entry/${experience.entryId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ verified: !experience.verified }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Failed to update verification');

            setOverview((prev) => prev ? ({
                ...prev,
                experiences: prev.experiences.map((item) =>
                    item.entryId === experience.entryId ? { ...item, verified: !item.verified } : item
                ),
            }) : prev);
            await fetchTrends(trendPeriod);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to update verification');
        } finally {
            setUpdatingEntryId(null);
        }
    };

    const openStudio = async (type: DocumentExportType) => {
        switchView('export');
        await loadExportPreview(type);
    };

    const resumePreviousSession = () => {
        if (!resumeSession) return;

        setSelectedExportType(normalizeDocumentExportType(resumeSession.selectedExportType));
        setStatementVariant(resumeSession.statementVariant);
        setEvidenceFilter(resumeSession.evidenceFilter);
        setActiveStoryEntryId(resumeSession.lastOpenedStoryId);
        setRecentViews(resumeSession.recentViews);
        switchView(
            resumeSession.selectedExportType === 'interview'
                ? 'interview'
                : resumeSession.selectedExportType === 'growth'
                    ? 'growth'
                    : resumeSession.view
        );
    };

    const renderExportMode = () => (
        <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
            <div className="space-y-4">
                <AppPanel className="space-y-4" id="portfolio-export-controls">
                    <SectionHeader
                        kicker="Documents"
                        title={selectedExportType === 'resume' ? 'Resume workspace' : 'Statement workspace'}
                        description="Open the document you need, preview it, and export it without losing your place."
                    />

                    <div className="flex flex-wrap gap-2">
                        <a
                            href="#portfolio-export-preview-panel"
                            className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.03] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-ink-secondary transition-colors hover:text-white hover:bg-white/[0.07]"
                        >
                            <FiEye size={13} aria-hidden="true" />
                            Jump to preview
                        </a>
                        <a
                            href="#portfolio-export-downloads"
                            className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.03] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-ink-secondary transition-colors hover:text-white hover:bg-white/[0.07]"
                        >
                            <FiDownload size={13} aria-hidden="true" />
                            Jump to downloads
                        </a>
                    </div>

                    <div
                        role="tablist"
                        aria-label="Choose which story document to open"
                        className="grid gap-3 sm:grid-cols-2"
                    >
                        {pathwayCards.map(({ type, Icon, title, description, readiness, secondary, isRecommended }) => {
                            const isActive = selectedExportType === type;

                            return (
                                <button
                                    key={type}
                                    id={`portfolio-export-tab-${type}`}
                                    type="button"
                                    role="tab"
                                    aria-selected={isActive}
                                    aria-controls="portfolio-export-preview-panel"
                                    tabIndex={isActive ? 0 : -1}
                                    onClick={() => {
                                        void loadExportPreview(type);
                                    }}
                                    className={`rounded-[26px] border p-4 text-left transition-colors ${
                                        isActive
                                            ? 'border-primary/35 bg-primary/12'
                                            : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.05]'
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className={`rounded-2xl border p-3 ${isActive || isRecommended ? 'border-primary/30 bg-primary/10 text-primary' : 'border-white/10 bg-white/5 text-white'}`}>
                                            <Icon size={18} aria-hidden="true" />
                                        </div>
                                        {isRecommended && <TagPill tone="primary">Recommended</TagPill>}
                                    </div>
                                    <h3 className="mt-4 text-lg font-semibold text-white">{title}</h3>
                                    <p className="mt-2 text-sm leading-6 text-ink-secondary">{description}</p>
                                    <div className="mt-4 space-y-1">
                                        <p className="text-sm text-white">{readiness}</p>
                                        <p className="text-xs text-ink-muted">{secondary}</p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {selectedPathwayCard && (
                        <div className="rounded-[30px] border border-white/10 bg-black/20 p-5">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <p className="text-xs uppercase tracking-[0.14em] text-ink-muted">Focused pack</p>
                                        {selectedPathwayCard.isRecommended && <TagPill tone="primary">Recommended next</TagPill>}
                                    </div>
                                    <h3 className="mt-2 text-2xl font-semibold text-white">{selectedPathwayCard.title}</h3>
                                    <p className="mt-2 text-sm leading-7 text-ink-secondary">{selectedPathwayCard.description}</p>
                                </div>
                                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-muted">Ready now</p>
                                    <p className="mt-2 text-sm font-semibold text-white">{selectedPathwayCard.readiness}</p>
                                </div>
                            </div>

                            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-muted">Best fit</p>
                                    <p className="mt-2 text-sm leading-6 text-white">{selectedPathwayCard.secondary}</p>
                                </div>
                                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-muted">Next move</p>
                                    <p className="mt-2 text-sm leading-6 text-white">
                                        {selectedExportType === 'resume' && 'Scan the preview for the strongest bullets, then export the pack you want to reuse.'}
                                        {selectedExportType === 'statement' && 'Pick the angle that matches your audience, then read the draft aloud before exporting.'}
                                    </p>
                                </div>
                            </div>

                            {selectedExportType === 'statement' && (
                                <div className="mt-4 rounded-[26px] border border-primary/20 bg-primary/[0.08] p-4">
                                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                        <div className="max-w-xl">
                                            <p className="text-xs uppercase tracking-[0.12em] text-primary/85">Statement angle</p>
                                            <p className="mt-2 text-sm leading-7 text-ink-secondary">
                                                Switch the tone for school, early-career work, or a general statement without leaving the preview.
                                            </p>
                                        </div>
                                        <div
                                            role="tablist"
                                            aria-label="Choose the statement angle"
                                            className="flex flex-wrap gap-2"
                                        >
                                            {(['standard', 'college', 'entry_job'] as StatementVariant[]).map((variant) => (
                                                <button
                                                    key={variant}
                                                    id={`portfolio-statement-tab-${variant}`}
                                                    type="button"
                                                    role="tab"
                                                    aria-selected={statementVariant === variant}
                                                    aria-controls="portfolio-statement-draft"
                                                    tabIndex={statementVariant === variant ? 0 : -1}
                                                    onClick={() => setStatementVariant(variant)}
                                                    className={`rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] whitespace-nowrap transition-colors ${
                                                        statementVariant === variant
                                                            ? 'bg-primary text-white'
                                                            : 'border border-white/10 bg-black/20 text-ink-secondary hover:text-white'
                                                    }`}
                                                >
                                                    {statementVariantLabels[variant]}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div
                                        id="portfolio-statement-draft"
                                        aria-live="polite"
                                        className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4"
                                    >
                                        <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Current draft angle</p>
                                        <p className="mt-3 text-sm leading-7 text-foreground">
                                            {statement || 'Build a little more evidence and profile direction to generate a stronger statement draft.'}
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div className="mt-4 flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        void loadExportPreview(selectedPathwayCard.type);
                                    }}
                                    className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/12 px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-primary transition-colors hover:bg-primary/20"
                                >
                                    <FiEye size={13} aria-hidden="true" />
                                    Preview
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        void downloadExport(selectedPathwayCard.type, 'html');
                                    }}
                                    disabled={downloadingKey === `${selectedPathwayCard.type}:html`}
                                    className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.05] px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-ink-secondary transition-colors hover:text-white hover:bg-white/10 disabled:opacity-60"
                                >
                                    <FiDownload size={13} aria-hidden="true" />
                                    {downloadingKey === `${selectedPathwayCard.type}:html` ? 'Preparing...' : 'HTML'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        void downloadExport(selectedPathwayCard.type, 'markdown');
                                    }}
                                    disabled={downloadingKey === `${selectedPathwayCard.type}:markdown`}
                                    className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-ink-secondary transition-colors hover:text-white hover:bg-white/10 disabled:opacity-60"
                                >
                                    <FiFileText size={13} aria-hidden="true" />
                                    {downloadingKey === `${selectedPathwayCard.type}:markdown` ? 'Preparing...' : 'Markdown'}
                                </button>
                            </div>
                        </div>
                    )}
                </AppPanel>
            </div>

            <AppPanel
                id="portfolio-export-preview-panel"
                className="space-y-4 xl:sticky xl:top-28"
                aria-labelledby="portfolio-export-preview-heading"
            >
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Preview</p>
                        <h2 id="portfolio-export-preview-heading" className="mt-1 text-2xl font-semibold text-white">
                            {exportTypeLabels[selectedExportType]}
                        </h2>
                        <p className="mt-1 text-sm text-ink-secondary">{exportTypeDescriptions[selectedExportType]}</p>
                    </div>
                    <ActionBar className="bg-black/20 border-white/10">
                        <button
                            type="button"
                            onClick={printSelectedExport}
                            disabled={downloadingKey === `${selectedExportType}:print`}
                            className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-ink-secondary hover:text-white"
                        >
                            <FiPrinter size={13} aria-hidden="true" />
                            {downloadingKey === `${selectedExportType}:print` ? 'Preparing...' : 'Print / PDF'}
                        </button>
                    </ActionBar>
                </div>

                <div
                    className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-ink-secondary"
                    aria-live="polite"
                >
                    {isPreviewLoading
                        ? `Loading ${exportTypeLabels[selectedExportType]} preview...`
                        : previewError
                            ? previewError
                            : `Viewing ${exportPreview?.fileName || `${exportTypeLabels[selectedExportType]} preview`} in the print-ready reader.`}
                </div>

                <div className="rounded-[32px] overflow-hidden border border-white/10 bg-[#f3efe6] text-slate-900 shadow-2xl shadow-black/20">
                    <div className="flex items-center justify-between gap-3 border-b border-slate-200/80 bg-white/80 px-4 py-3">
                        <div>
                            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Quick View</p>
                            <h3 className="mt-1 text-sm font-semibold text-slate-900">
                                {exportPreview?.fileName || `${exportTypeLabels[selectedExportType]} Preview`}
                            </h3>
                        </div>
                        <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] uppercase tracking-[0.12em] text-slate-600">
                            Print-ready HTML
                        </div>
                    </div>

                    <div id="portfolio-export-preview" className="relative min-h-[30rem] bg-[#f8f6f1]">
                        {isPreviewLoading && (
                            <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#f8f6f1]/80">
                                <div className="h-7 w-7 animate-spin rounded-full border-4 border-slate-400 border-t-transparent" />
                            </div>
                        )}

                        {exportPreview && !previewError ? (
                            <iframe
                                title={`${exportTypeLabels[exportPreview.type]} preview document`}
                                srcDoc={exportPreview.content}
                                sandbox=""
                                className="h-[32rem] w-full bg-white"
                            />
                        ) : (
                            <div className="flex h-[32rem] flex-col items-center justify-center px-6 text-center">
                                <div className="rounded-2xl border border-slate-200 bg-white p-4 text-slate-700 shadow-sm">
                                    <FiUploadCloud size={20} aria-hidden="true" />
                                </div>
                                <h3 className="mt-4 text-lg font-semibold text-slate-900">Open a pack to preview it</h3>
                                <p className="mt-2 max-w-sm text-sm text-slate-600">
                                    Choose a pack on the left to load a document-style preview before you download anything.
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {previewError && (
                    <div className="rounded-xl border border-white/12 bg-white/[0.05] px-3 py-2 text-sm text-foreground">
                        {previewError}
                    </div>
                )}

                <div id="portfolio-export-downloads" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <button
                        type="button"
                        onClick={() => {
                            void downloadExport(selectedExportType, 'html');
                        }}
                        disabled={downloadingKey === `${selectedExportType}:html`}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-primary/35 bg-primary/15 px-4 py-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/25 disabled:opacity-60"
                    >
                        <FiDownload size={15} aria-hidden="true" />
                        {downloadingKey === `${selectedExportType}:html` ? 'Preparing HTML...' : 'Download HTML'}
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            void downloadExport(selectedExportType, 'markdown');
                        }}
                        disabled={downloadingKey === `${selectedExportType}:markdown`}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.05] px-4 py-3 text-sm font-semibold text-ink-secondary transition-colors hover:text-white hover:bg-white/10 disabled:opacity-60"
                    >
                        <FiFileText size={15} aria-hidden="true" />
                        {downloadingKey === `${selectedExportType}:markdown` ? 'Preparing Markdown...' : 'Download Markdown'}
                    </button>
                </div>
            </AppPanel>
        </div>
    );

    const editingExperience = useMemo(
        () => (editingEntryId ? experienceByEntryId.get(editingEntryId) || null : null),
        [editingEntryId, experienceByEntryId]
    );
    const editingDraft = editingEntryId ? drafts[editingEntryId] || null : null;

    const renderEvidenceMode = () => (
        <div className="space-y-5">
            <AppPanel className="space-y-5">
                <SectionHeader
                    kicker="Evidence"
                    title="Evidence Queue"
                    description="Fix weak stories, verify strong ones, and jump straight into the right export path."
                    actionLabel="Quick Capture"
                    actionHref={captureHref}
                />

                <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                    <StatTile label="Entries Scored" value={evidenceSummary.total} hint="Experiences mapped from entries" />
                    <StatTile label="Needs Attention" value={filterCounts.needs_attention} hint="Missing core detail" />
                    <StatTile label="Ready To Verify" value={filterCounts.ready_to_verify} hint="Structured but not verified" />
                    <StatTile label="Verified" value={filterCounts.verified} hint="Strongest source material" tone="primary" />
                </div>

                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                    <ActionBar className="gap-2 overflow-x-auto bg-black/20 border-white/10">
                        {evidenceFilters.map((filter) => (
                            <button
                                key={filter}
                                type="button"
                                onClick={() => setEvidenceFilter(filter)}
                                aria-pressed={evidenceFilter === filter}
                                className={`rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] whitespace-nowrap transition-colors ${
                                    evidenceFilter === filter
                                        ? 'bg-primary/15 text-primary'
                                        : 'text-ink-secondary hover:text-white'
                                }`}
                            >
                                {evidenceFilterLabels[filter]} ({filterCounts[filter]})
                            </button>
                        ))}
                    </ActionBar>

                    <ActionBar className="gap-2 overflow-x-auto bg-black/20 border-white/10">
                        <button
                            type="button"
                            onClick={() => {
                                void openStudio('resume');
                            }}
                            className="rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-ink-secondary whitespace-nowrap hover:text-white"
                        >
                            Open Resume
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                switchView('interview');
                            }}
                            className="rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-ink-secondary whitespace-nowrap hover:text-white"
                        >
                            Open Interview
                        </button>
                    </ActionBar>
                </div>
            </AppPanel>

            {filteredExperiences.length === 0 ? (
                <EmptyState
                    title="No evidence in this lane yet"
                    description="Switch filters or capture another quick entry to generate more stories for the queue."
                    actionLabel="Start Quick Capture"
                    actionHref={captureHref}
                />
            ) : (
                <div className="grid gap-3">
                    {filteredExperiences.map((experience) => {
                        const meta = experienceMetaByEntryId.get(experience.entryId) || getExperienceMeta(experience);
                        const { completeness, state } = meta;
                        const sourceHref = appendReturnTo(`/entry/view?id=${experience.entryId}`, currentReturnTo);
                        const primarySnippet = experience.outcome || experience.action || experience.lesson || experience.situation;
                        const stateTone = state === 'verified' ? 'primary' : state === 'needs_attention' ? 'muted' : 'default';

                        return (
                            <article
                                key={experience.entryId}
                                className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4 transition-colors hover:border-white/15 hover:bg-white/[0.05]"
                            >
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                    <div className="min-w-0 space-y-3">
                                        <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.12em] text-ink-muted">
                                            <span>{formatShortDate(experience.createdAt)}</span>
                                            <span className="text-white/20">/</span>
                                            <span>{formatRelativeTime(experience.createdAt)}</span>
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-semibold text-white">{experience.title || 'Untitled experience'}</h3>
                                            <p className="mt-2 max-w-3xl text-sm leading-7 text-ink-secondary">
                                                {primarySnippet || 'Add outcome, lesson, and skill detail so this story is ready for export.'}
                                            </p>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            <TagPill tone={stateTone}>{evidenceFilterLabels[state]}</TagPill>
                                            <TagPill>{completeness.score}% complete</TagPill>
                                            <TagPill>{formatRatioPercent(experience.confidence || 0)} confidence</TagPill>
                                            {experience.verified && <TagPill tone="primary">Verified story</TagPill>}
                                        </div>
                                        {completeness.missingFields.length > 0 && (
                                            <div className="flex flex-wrap gap-2">
                                                {completeness.missingFields.map((field) => (
                                                    <TagPill key={field} tone="muted">
                                                        Missing {EVIDENCE_FIELD_LABELS[field]}
                                                    </TagPill>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="grid min-w-[15rem] gap-2 sm:grid-cols-2 lg:w-[18rem] lg:grid-cols-1">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                void toggleVerified(experience);
                                            }}
                                            disabled={updatingEntryId === experience.entryId}
                                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/12 px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-primary transition-colors hover:bg-primary/20 disabled:opacity-60"
                                        >
                                            <FiCheckCircle size={14} aria-hidden="true" />
                                            {updatingEntryId === experience.entryId
                                                ? 'Updating...'
                                                : experience.verified
                                                    ? 'Mark Unverified'
                                                    : 'Verify'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => startEdit(experience)}
                                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.05] px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-ink-secondary transition-colors hover:bg-white/10 hover:text-white"
                                        >
                                            <FiEdit2 size={14} aria-hidden="true" />
                                            Edit in Drawer
                                        </button>
                                        <Link
                                            href={sourceHref}
                                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-ink-secondary transition-colors hover:bg-white/10 hover:text-white"
                                        >
                                            <FiArrowRight size={14} aria-hidden="true" />
                                            Open Source Entry
                                        </Link>
                                    </div>
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}
        </div>
    );

    const renderInterviewMode = () => {
        if (!overview || overview.interviewStories.length === 0) {
            return (
                <EmptyState
                    title="No interview stories yet"
                    description="Verify a few stronger experiences and the interview workspace will build a focused STAR story set."
                    actionLabel="Open Evidence Queue"
                    actionHref={`${pathname}?view=evidence`}
                />
            );
        }

        const stories = overview.interviewStories;
        const story = activeInterviewStory || stories[0];
        const activeIndex = Math.max(stories.findIndex((item) => item.entryId === story.entryId), 0);
        const experience = activeInterviewExperience;
        const sourceHref = appendReturnTo(`/entry/view?id=${story.entryId}`, currentReturnTo);
        const canGoPrevious = activeIndex > 0;
        const canGoNext = activeIndex < stories.length - 1;

        return (
            <div className="grid gap-6 xl:grid-cols-[290px_minmax(0,1fr)]">
                <AppPanel className="space-y-4">
                    <SectionHeader
                        kicker="Interview"
                        title="Interview workspace"
                        description="Preview one story at a time, then switch into practice mode without losing the source context."
                    />
                    <div className="space-y-2">
                        {stories.map((item, index) => (
                            <button
                                key={item.entryId}
                                type="button"
                                onClick={() => setActiveStoryEntryId(item.entryId)}
                                className={`w-full rounded-2xl border px-4 py-3 text-left transition-colors ${
                                    item.entryId === story.entryId
                                        ? 'border-primary/30 bg-primary/12'
                                        : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.05]'
                                }`}
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-semibold text-white">{item.title}</p>
                                        <p className="mt-1 text-xs uppercase tracking-[0.12em] text-ink-muted">
                                            Story {index + 1}
                                        </p>
                                    </div>
                                    {experienceMetaByEntryId.get(item.entryId)?.state === 'verified' && <TagPill tone="primary">Verified</TagPill>}
                                </div>
                            </button>
                        ))}
                    </div>
                </AppPanel>

                <div className="space-y-4">
                    <AppPanel className="space-y-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                                <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Focused Story</p>
                                <h2 className="mt-1 text-2xl font-semibold text-white">{story.title}</h2>
                                <p className="mt-2 text-sm text-ink-secondary">
                                    Stay with one story at a time, switch into recall mode, then reveal the scaffold when you want to compare.
                                </p>
                            </div>
                            <ActionBar className="bg-black/20 border-white/10">
                                <button
                                    type="button"
                                    onClick={() => setPracticeMode((value) => !value)}
                                    aria-pressed={practiceMode}
                                    className={`rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] transition-colors ${
                                        practiceMode ? 'bg-primary/15 text-primary' : 'text-ink-secondary hover:text-white'
                                    }`}
                                >
                                    {practiceMode ? 'Recall First' : 'Guided View'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => canGoPrevious && setActiveStoryEntryId(stories[activeIndex - 1]?.entryId || story.entryId)}
                                    disabled={!canGoPrevious}
                                    className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-ink-secondary transition-colors hover:text-white disabled:opacity-40"
                                >
                                    <FiChevronLeft size={14} aria-hidden="true" />
                                    Prev
                                </button>
                                <button
                                    type="button"
                                    onClick={() => canGoNext && setActiveStoryEntryId(stories[activeIndex + 1]?.entryId || story.entryId)}
                                    disabled={!canGoNext}
                                    className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-ink-secondary transition-colors hover:text-white disabled:opacity-40"
                                >
                                    Next
                                    <FiChevronRight size={14} aria-hidden="true" />
                                </button>
                            </ActionBar>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <TagPill tone={experience?.verified ? 'primary' : 'default'}>
                                {experience?.verified ? 'Verified source' : 'Needs verification'}
                            </TagPill>
                            {(experience?.skills || []).slice(0, 4).map((skill) => (
                                <TagPill key={skill}>{skill}</TagPill>
                            ))}
                            {hasValue(experience?.lesson) && <TagPill tone="muted">{experience?.lesson}</TagPill>}
                        </div>
                    </AppPanel>

                    <AppPanel className="space-y-4">
                        {practiceMode && !practiceReveal ? (
                            <div className="rounded-[28px] border border-white/10 bg-black/20 p-6 text-center">
                                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/30 bg-primary/12 text-primary">
                                    <FiMessageSquare size={20} aria-hidden="true" />
                                </div>
                                <h3 className="mt-4 text-xl font-semibold text-white">Try the story from memory first</h3>
                                <p className="mt-2 text-sm leading-7 text-ink-secondary">
                                    Say it out loud before reading. Reveal the scaffold only when you want to compare your version with the structured story.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => setPracticeReveal(true)}
                                    className="mt-5 inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/12 px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-primary transition-colors hover:bg-primary/20"
                                >
                                    <FiEye size={14} aria-hidden="true" />
                                    Reveal story scaffold
                                </button>
                            </div>
                        ) : (
                            <div className="grid gap-4 md:grid-cols-2">
                                {[
                                    { label: 'Situation', value: story.situation },
                                    { label: 'Task', value: story.task },
                                    { label: 'Action', value: story.action },
                                    { label: 'Result', value: story.result },
                                ].map((section) => (
                                    <div key={section.label} className="rounded-[26px] border border-white/10 bg-white/[0.03] p-4">
                                        <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">{section.label}</p>
                                        <p className="mt-3 text-sm leading-7 text-foreground">{section.value || 'Add more evidence detail to strengthen this section.'}</p>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="flex flex-wrap gap-2">
                            <Link
                                href={sourceHref}
                                className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.05] px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-ink-secondary transition-colors hover:bg-white/10 hover:text-white"
                            >
                                <FiArrowRight size={14} aria-hidden="true" />
                                Open Source Entry
                            </Link>
                            {experience && (
                                <button
                                    type="button"
                                    onClick={() => startEdit(experience)}
                                    className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-ink-secondary transition-colors hover:bg-white/10 hover:text-white"
                                >
                                    <FiEdit2 size={14} aria-hidden="true" />
                                    Refine Story
                                </button>
                            )}
                        </div>
                    </AppPanel>
                </div>
            </div>
        );
    };

    const renderGrowthMode = () => {
        const verifiedRate = overview && overview.stats.experienceCount > 0
            ? overview.stats.verifiedCount / overview.stats.experienceCount
            : 0;
        const outputGoals = overview?.profileContext?.outputGoals || [];

        return (
            <div className="space-y-6">
                <AppPanel className="space-y-5">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <SectionHeader
                            kicker="Progress"
                            title="Read progress, proof, and direction"
                            description="Review momentum over time, repeated strengths, and the next place to strengthen your outcome story system."
                        />
                        <ActionBar className="bg-black/20 border-white/10">
                            {(['week', 'month'] as const).map((period) => (
                                <button
                                    key={period}
                                    type="button"
                                    onClick={() => setTrendPeriod(period)}
                                    aria-pressed={trendPeriod === period}
                                    className={`rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] transition-colors ${
                                        trendPeriod === period
                                            ? 'bg-primary/15 text-primary'
                                            : 'text-ink-secondary hover:text-white'
                                    }`}
                                >
                                    {period}
                                </button>
                            ))}
                        </ActionBar>
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                        <StatTile label="Verified Rate" value={formatRatioPercent(verifiedRate)} hint="Share of stories moved into verified proof" tone="primary" />
                        <StatTile label="Story Quality" value={`${evidenceSummary.avgScore}%`} hint="Average completeness across story parts" />
                        <StatTile label="Top Skills" value={overview?.topSkills.length || 0} hint="Repeated strengths across stories" />
                        <StatTile
                            label="Lens Readiness"
                            value={`${overview?.profileContext?.completionScore || 0}%`}
                            hint={overview?.profileContext ? `${formatLabel(overview.profileContext.track)} track` : 'Set your direction'}
                        />
                    </div>
                </AppPanel>

                <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                    <AppPanel className="space-y-5">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Trendline</p>
                                <h3 className="mt-1 text-xl font-semibold text-white">Momentum across the last six windows</h3>
                            </div>
                            <TagPill tone="primary">
                                Updated {trends ? formatRelativeTime(trends.points[trends.points.length - 1]?.periodStart || overview?.generatedAt || new Date().toISOString()) : 'recently'}
                            </TagPill>
                        </div>

                        {trends && trends.points.length > 0 ? (
                            <div className="space-y-3">
                                {trends.points.map((point) => {
                                    const entriesWidth = `${Math.max((point.entries / maxTrendValue) * 100, point.entries > 0 ? 12 : 0)}%`;
                                    const verifiedWidth = `${Math.max((point.verified / maxTrendValue) * 100, point.verified > 0 ? 12 : 0)}%`;

                                    return (
                                        <div key={point.periodStart} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                            <div className="flex flex-wrap items-center justify-between gap-3">
                                                <p className="text-sm font-semibold text-white">{point.periodLabel}</p>
                                                <div className="flex flex-wrap gap-2 text-xs text-ink-muted">
                                                    <span>{point.entries} entries</span>
                                                    <span>{point.verified} verified</span>
                                                    <span>{formatRatioPercent(point.averageConfidence || 0)} confidence</span>
                                                </div>
                                            </div>
                                            <div className="mt-4 space-y-2">
                                                <div>
                                                    <div className="mb-1 flex items-center justify-between text-[11px] uppercase tracking-[0.12em] text-ink-muted">
                                                        <span>Entries</span>
                                                        <span>{point.entries}</span>
                                                    </div>
                                                    <div className="h-2 rounded-full bg-white/10">
                                                        <div className="h-full rounded-full bg-white/40" style={{ width: entriesWidth }} />
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="mb-1 flex items-center justify-between text-[11px] uppercase tracking-[0.12em] text-ink-muted">
                                                        <span>Verified</span>
                                                        <span>{point.verified}</span>
                                                    </div>
                                                    <div className="h-2 rounded-full bg-white/10">
                                                        <div className="h-full rounded-full bg-primary" style={{ width: verifiedWidth }} />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <EmptyState
                                title="Growth data is still warming up"
                                description="Keep capturing and shaping evidence. The growth map becomes more useful once a few windows of activity accumulate."
                                actionLabel="Start Quick Capture"
                                actionHref={captureHref}
                            />
                        )}
                    </AppPanel>

                    <div className="space-y-4">
                        <AppPanel className="space-y-4">
                            <div className="flex items-center gap-2 text-primary">
                                <FiFlag size={16} aria-hidden="true" />
                                <p className="text-xs uppercase tracking-[0.12em]">Current lens</p>
                            </div>
                            <div className="space-y-3 text-sm text-ink-secondary">
                                <p>
                                    <span className="text-ink-muted">Primary goal:</span>{' '}
                                    <span className="text-white">{overview?.profileContext?.primaryGoal || 'Not set yet'}</span>
                                </p>
                                <p>
                                    <span className="text-ink-muted">Focus area:</span>{' '}
                                    <span className="text-white">{overview?.profileContext?.focusArea || 'Not set yet'}</span>
                                </p>
                                <p>
                                    <span className="text-ink-muted">Capture style:</span>{' '}
                                    <span className="text-white">{formatLabel(overview?.profileContext?.writingPreference)}</span>
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {outputGoals.length > 0 ? outputGoals.map((goal) => <TagPill key={goal}>{formatLabel(goal)}</TagPill>) : <TagPill tone="muted">Set output goals</TagPill>}
                            </div>
                            <Link
                                href={profileHref}
                                className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.05] px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-ink-secondary transition-colors hover:bg-white/10 hover:text-white"
                            >
                                <FiTool size={14} aria-hidden="true" />
                                Tune story lens
                            </Link>
                        </AppPanel>

                        <AppPanel className="space-y-4">
                            <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Repeated material</p>
                            <div className="space-y-3">
                                <div>
                                    <p className="text-sm font-semibold text-white">Skills surfacing most</p>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {(overview?.topSkills || []).slice(0, 8).map((skill) => (
                                            <TagPill key={skill} tone="primary">{skill}</TagPill>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-white">Lessons worth carrying forward</p>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {(overview?.topLessons || []).slice(0, 8).map((lesson) => (
                                            <TagPill key={lesson}>{lesson}</TagPill>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </AppPanel>

                        <AppPanel className="space-y-4">
                            <div className="flex items-center gap-2 text-primary">
                                <FiClock size={16} aria-hidden="true" />
                                <p className="text-xs uppercase tracking-[0.12em]">Return points</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {recentViewLinks.length > 0 ? recentViewLinks.map((view) => (
                                    <button
                                        key={view}
                                        type="button"
                                        onClick={() => switchView(view)}
                                        className="rounded-xl border border-white/15 bg-white/[0.05] px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-ink-secondary transition-colors hover:bg-white/10 hover:text-white"
                                    >
                                        {portfolioViewLabels[view]}
                                    </button>
                                )) : (
                                    <TagPill tone="muted">Your recent studio paths will show here</TagPill>
                                )}
                            </div>
                            {resumeSession && (
                                <button
                                    type="button"
                                    onClick={resumePreviousSession}
                                    className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/12 px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-primary transition-colors hover:bg-primary/20"
                                >
                                    <FiArrowRight size={14} aria-hidden="true" />
                                    Resume {buildResumeLabel(resumeSession)}
                                </button>
                            )}
                        </AppPanel>
                    </div>
                </div>
            </div>
        );
    };

    const renderEditingDrawer = () => {
        if (!editingEntryId || !editingExperience || !editingDraft) return null;

        const draftCompleteness = getDraftCompleteness(editingDraft);
        const sourceHref = appendReturnTo(`/entry/view?id=${editingExperience.entryId}`, currentReturnTo);
        const fields: Array<{ field: keyof Draft; label: string; placeholder: string; rows?: number }> = [
            { field: 'title', label: 'Title', placeholder: 'Give this story a clear label' },
            { field: 'situation', label: 'Situation', placeholder: 'What context should a reader know first?', rows: 4 },
            { field: 'action', label: 'Action', placeholder: 'What did you actually do?', rows: 4 },
            { field: 'outcome', label: 'Outcome', placeholder: 'What changed or improved?', rows: 4 },
            { field: 'lesson', label: 'Lesson', placeholder: 'What should this story teach or prove?', rows: 4 },
        ];

        return (
            <AnimatePresence>
                <motion.div
                    key={editingEntryId}
                    className="fixed inset-0 z-50 flex items-end bg-black/70 p-0 backdrop-blur-sm md:items-stretch md:justify-end md:p-4"
                    initial={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
                    transition={{ duration: reduceMotion ? 0 : 0.18 }}
                    onClick={() => setEditingEntryId(null)}
                >
                    <motion.div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="portfolio-evidence-editor-title"
                        className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-[32px] border border-white/10 bg-[#07111f] shadow-2xl shadow-black/50 md:ml-auto md:h-[calc(100vh-2rem)] md:max-w-2xl md:rounded-[32px]"
                        initial={reduceMotion ? { opacity: 1 } : { y: 32, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={reduceMotion ? { opacity: 1 } : { y: 24, opacity: 0 }}
                        transition={{ duration: reduceMotion ? 0 : 0.2 }}
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4 md:px-6">
                            <div>
                                <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Story Refinery</p>
                                <h2 id="portfolio-evidence-editor-title" className="mt-1 text-xl font-semibold text-white">
                                    {editingExperience.title || 'Refine story'}
                                </h2>
                                <p className="mt-2 text-sm text-ink-secondary">
                                    Sharpen the evidence here without expanding the main workspace into a long editing thread.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setEditingEntryId(null)}
                                className="rounded-xl border border-white/15 bg-white/[0.05] p-2 text-ink-secondary transition-colors hover:bg-white/10 hover:text-white"
                                aria-label="Close evidence editor"
                            >
                                <FiX size={16} aria-hidden="true" />
                            </button>
                        </div>

                        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 md:px-6">
                            <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                        <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Draft readiness</p>
                                        <p className="mt-1 text-lg font-semibold text-white">{draftCompleteness.score}% complete</p>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <TagPill>{draftCompleteness.presentCount}/{draftCompleteness.totalCount} blocks filled</TagPill>
                                        <TagPill tone={editingExperience.verified ? 'primary' : 'muted'}>
                                            {editingExperience.verified ? 'Verified' : 'Not verified'}
                                        </TagPill>
                                    </div>
                                </div>
                                <div className="mt-4 h-2 rounded-full bg-white/10">
                                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${draftCompleteness.score}%` }} />
                                </div>
                            </div>

                            <div className="space-y-4">
                                {fields.map(({ field, label, placeholder, rows }) => (
                                    <label key={field} className="block">
                                        <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">
                                            {label}
                                        </span>
                                        {rows ? (
                                            <textarea
                                                value={editingDraft[field]}
                                                rows={rows}
                                                onChange={(event) => updateDraft(editingExperience.entryId, field, event.target.value)}
                                                placeholder={placeholder}
                                                className="min-h-[7rem] w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-ink-muted outline-none transition-colors focus:border-primary/35 focus:bg-white/[0.06]"
                                            />
                                        ) : (
                                            <input
                                                value={editingDraft[field]}
                                                onChange={(event) => updateDraft(editingExperience.entryId, field, event.target.value)}
                                                placeholder={placeholder}
                                                className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-ink-muted outline-none transition-colors focus:border-primary/35 focus:bg-white/[0.06]"
                                            />
                                        )}
                                    </label>
                                ))}

                                <label className="block">
                                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">Skills</span>
                                    <input
                                        value={editingDraft.skillsText}
                                        onChange={(event) => updateDraft(editingExperience.entryId, 'skillsText', event.target.value)}
                                        placeholder="communication, leadership, analysis"
                                        className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-ink-muted outline-none transition-colors focus:border-primary/35 focus:bg-white/[0.06]"
                                    />
                                </label>

                                <label className="block">
                                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">Verification Notes</span>
                                    <textarea
                                        value={editingDraft.notes}
                                        rows={4}
                                        onChange={(event) => updateDraft(editingExperience.entryId, 'notes', event.target.value)}
                                        placeholder="Add evidence notes, metrics, or follow-up proof to verify later."
                                        className="min-h-[7rem] w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-ink-muted outline-none transition-colors focus:border-primary/35 focus:bg-white/[0.06]"
                                    />
                                </label>
                            </div>
                        </div>

                        <div className="border-t border-white/10 px-5 py-4 md:px-6">
                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                <div className="flex flex-wrap gap-2">
                                    <Link
                                        href={sourceHref}
                                        className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.05] px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-ink-secondary transition-colors hover:bg-white/10 hover:text-white"
                                    >
                                        <FiArrowRight size={14} aria-hidden="true" />
                                        Source Entry
                                    </Link>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            void toggleVerified(editingExperience);
                                        }}
                                        disabled={updatingEntryId === editingExperience.entryId}
                                        className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/12 px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-primary transition-colors hover:bg-primary/20 disabled:opacity-60"
                                    >
                                        <FiCheckCircle size={14} aria-hidden="true" />
                                        {editingExperience.verified ? 'Mark Unverified' : 'Verify Story'}
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setEditingEntryId(null)}
                                        className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-ink-secondary transition-colors hover:bg-white/10 hover:text-white"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            void saveDraft(editingExperience.entryId);
                                        }}
                                        disabled={savingEntryId === editingExperience.entryId}
                                        className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-white transition-colors hover:bg-primary/90 disabled:opacity-60"
                                    >
                                        <FiEdit2 size={14} aria-hidden="true" />
                                        {savingEntryId === editingExperience.entryId ? 'Saving...' : 'Save Changes'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            </AnimatePresence>
        );
    };

    const renderActiveMode = () => {
        if (activeView === 'export') return renderExportMode();
        if (activeView === 'evidence') return renderEvidenceMode();
        if (activeView === 'interview') return renderInterviewMode();
        return renderGrowthMode();
    };

    if (authLoading || isLoading) {
        return (
            <div className="flex min-h-[50vh] items-center justify-center px-4 py-10">
                <div className="flex flex-col items-center gap-3 text-center">
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/20 border-t-primary" />
                    <p className="text-sm text-ink-secondary">Getting your stories ready...</p>
                </div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return null;
    }

    if (!overview) {
        return (
            <div className="space-y-4 px-1 py-4">
                <EmptyState
                    title="Stories are not ready yet"
                    description={error || 'We could not load this page. Try again when your notes are available.'}
                    actionLabel="Write"
                    actionHref={captureHref}
                />
                <div className="flex justify-center">
                    <button
                        type="button"
                        onClick={() => {
                            void fetchOverview();
                            void fetchTrends(trendPeriod);
                        }}
                        className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.05] px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-ink-secondary transition-colors hover:bg-white/10 hover:text-white"
                    >
                        <FiArrowRight size={14} aria-hidden="true" />
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    const ActiveViewIcon = portfolioViewIcons[activeView];
    const currentWorkspaceLabel = activeView === 'export' ? exportTypeLabels[selectedExportType] : portfolioViewLabels[activeView];

    return (
        <div className="space-y-6 px-1 pb-32 pt-2">
            <AppPanel className="sticky top-20 z-20 space-y-5 border-white/15 bg-[radial-gradient(circle_at_top_left,rgba(31,96,255,0.14),transparent_38%),rgba(5,10,20,0.92)] backdrop-blur-xl">
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
                    <div className="space-y-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                                <p className="text-xs uppercase tracking-[0.14em] text-ink-muted">Stories</p>
                                <h1 className="mt-1 text-3xl font-semibold text-white">Choose the story job you want to do now</h1>
                                <p className="mt-2 max-w-2xl text-sm leading-7 text-ink-secondary">
                                    Use one mode at a time: shape a pack, fix missing evidence, rehearse one story, or review growth.
                                </p>
                            </div>
                            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-2 text-xs uppercase tracking-[0.12em] text-ink-muted">
                                <ActiveViewIcon size={14} aria-hidden="true" />
                                Current destination: {currentWorkspaceLabel}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            <StatTile label="Ready To Use" value={filterCounts.ready_to_export} hint="Stories you can export now" tone="primary" />
                            <StatTile label="Need Work" value={filterCounts.needs_attention} hint="Stories missing detail" />
                            <StatTile label="Practice Deck" value={overview.interviewStories.length} hint="Stories ready to rehearse" />
                        </div>
                    </div>

                    <div className="grid gap-3">
                        <div className="rounded-[28px] border border-primary/25 bg-primary/12 p-4">
                            <div className="flex items-start gap-3">
                                <div className="rounded-2xl border border-primary/30 bg-primary/15 p-3 text-primary">
                                    <FiZap size={18} aria-hidden="true" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs uppercase tracking-[0.12em] text-primary/80">Today</p>
                                    <h2 className="mt-2 text-lg font-semibold text-white">{nextAction.title}</h2>
                                    <p className="mt-2 text-sm leading-7 text-ink-secondary">{nextAction.description}</p>
                                </div>
                            </div>
                            <div className="mt-4">
                                {nextAction.targetView ? (
                                    <button
                                        type="button"
                                        onClick={() => switchView(nextAction.targetView!)}
                                        className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-white transition-colors hover:bg-primary/90"
                                    >
                                        {nextAction.actionLabel}
                                        <FiArrowRight size={14} aria-hidden="true" />
                                    </button>
                                ) : (
                                    <Link
                                        href={nextAction.actionHref || captureHref}
                                        className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-white transition-colors hover:bg-primary/90"
                                    >
                                        {nextAction.actionLabel}
                                        <FiArrowRight size={14} aria-hidden="true" />
                                    </Link>
                                )}
                            </div>
                        </div>

                        <div className="rounded-[28px] border border-white/10 bg-black/20 p-4">
                            <div className="flex items-start gap-3">
                                <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-3 text-ink-secondary">
                                    <FiClock size={18} aria-hidden="true" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Resume</p>
                                    {resumeSession ? (
                                        <>
                                            <h2 className="mt-2 text-lg font-semibold text-white">{buildResumeLabel(resumeSession)}</h2>
                                            <p className="mt-2 text-sm leading-7 text-ink-secondary">
                                                Last active {formatRelativeTime(resumeSession.updatedAt)}. Go back to the same mode without setting it up again.
                                            </p>
                                        </>
                                    ) : (
                                        <p className="mt-2 text-sm leading-7 text-ink-secondary">
                                            As you move through stories, Notive will remember your last view and bring it back here.
                                        </p>
                                    )}
                                </div>
                            </div>
                            {resumeSession && (
                                <button
                                    type="button"
                                    onClick={resumePreviousSession}
                                    className="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.05] px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-ink-secondary transition-colors hover:bg-white/10 hover:text-white"
                                >
                                    Resume last view
                                    <FiArrowRight size={14} aria-hidden="true" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <div className="space-y-3 rounded-[22px] border border-white/10 bg-black/20 p-3">
                        <p className="px-1 text-xs uppercase tracking-[0.12em] text-ink-muted">Open a destination directly</p>
                        <div className="grid gap-2 md:grid-cols-4">
                            {[
                                {
                                    id: 'resume',
                                    label: 'Resume',
                                    detail: 'Preview and export',
                                    icon: FiFileText,
                                    active: activeView === 'export' && selectedExportType === 'resume',
                                    recommended: recommendedView === 'export' && recommendedExportType === 'resume',
                                    onClick: () => { void openStudio('resume'); },
                                },
                                {
                                    id: 'statement',
                                    label: 'Statement',
                                    detail: 'Choose angle and export',
                                    icon: FiBookOpen,
                                    active: activeView === 'export' && selectedExportType === 'statement',
                                    recommended: recommendedView === 'export' && recommendedExportType === 'statement',
                                    onClick: () => { void openStudio('statement'); },
                                },
                                {
                                    id: 'interview',
                                    label: 'Interview',
                                    detail: 'Preview and practice',
                                    icon: FiMessageSquare,
                                    active: activeView === 'interview',
                                    recommended: recommendedView === 'interview',
                                    onClick: () => switchView('interview'),
                                },
                                {
                                    id: 'growth',
                                    label: 'Growth',
                                    detail: 'Review progress',
                                    icon: FiTrendingUp,
                                    active: activeView === 'growth',
                                    recommended: recommendedView === 'growth',
                                    onClick: () => switchView('growth'),
                                },
                            ].map(({ id, label, detail, icon: Icon, active, recommended, onClick }) => (
                                <button
                                    key={id}
                                    type="button"
                                    onClick={onClick}
                                    className={`inline-flex items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left transition-colors ${
                                        active
                                            ? 'bg-primary text-white shadow-lg shadow-primary/20'
                                            : 'bg-white/[0.02] text-ink-secondary hover:bg-white/[0.05] hover:text-white'
                                    }`}
                                >
                                    <span className="inline-flex items-center gap-3">
                                        <span className={`rounded-xl border p-2 ${active ? 'border-white/20 bg-white/10' : 'border-white/10 bg-white/[0.03]'}`}>
                                            <Icon size={15} aria-hidden="true" />
                                        </span>
                                        <span>
                                            <span className="block text-sm font-semibold">{label}</span>
                                            <span className="block text-[11px] uppercase tracking-[0.12em] opacity-80">{detail}</span>
                                        </span>
                                    </span>
                                    {recommended && (
                                        <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${active ? 'bg-white/15' : 'bg-primary/15 text-primary'}`}>
                                            Next
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => switchView('evidence')}
                                className={`rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] transition-colors ${
                                    activeView === 'evidence'
                                        ? 'border-primary/30 bg-primary/12 text-primary'
                                        : 'border-white/12 bg-white/[0.03] text-ink-secondary hover:text-white hover:bg-white/[0.06]'
                                }`}
                            >
                                Evidence queue
                            </button>
                            {resumeSession && (
                                <button
                                    type="button"
                                    onClick={resumePreviousSession}
                                    className="rounded-full border border-white/12 bg-white/[0.03] px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-ink-secondary transition-colors hover:text-white hover:bg-white/[0.06]"
                                >
                                    Resume last place
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </AppPanel>

            {error && (
                <div className="rounded-2xl border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                    {error}
                </div>
            )}

            <AnimatePresence mode="wait" initial={false}>
                <motion.div
                    key={activeView}
                    initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -10 }}
                    transition={{ duration: reduceMotion ? 0 : 0.22 }}
                    className="space-y-6"
                >
                    {renderActiveMode()}
                </motion.div>
            </AnimatePresence>

            {renderEditingDrawer()}
        </div>
    );
}
