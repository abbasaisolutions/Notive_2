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
import { ErrorState, Spinner } from '@/components/ui';
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
import { NOTIVE_VOICE } from '@/content/notive-voice';

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

const statementVariants: StatementVariant[] = ['standard', 'college', 'entry_job'];
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

const statementVariantDescriptions: Record<StatementVariant, string> = {
    standard: 'Balanced voice for a general statement that can flex across uses.',
    college: 'Leans toward growth, direction, and why the next academic step fits.',
    entry_job: 'Leans toward readiness, initiative, and what you can contribute early.',
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
    const [showExportTools, setShowExportTools] = useState(false);
    const [showInterviewTools, setShowInterviewTools] = useState(false);
    const [showEditingDetails, setShowEditingDetails] = useState(false);
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
            if (!response.ok) throw new Error(data.message || 'Couldn\u2019t load your portfolio.');
            setOverview(data.overview as Overview);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Couldn\u2019t load your portfolio.');
        } finally {
            setIsLoading(false);
        }
    }, [apiFetch, isAuthenticated]);

    const fetchTrends = useCallback(async (period: 'week' | 'month') => {
        if (!isAuthenticated) return;

        try {
            const response = await apiFetch(`${API_URL}/ai/opportunity/trends?period=${period}&window=6`);
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Couldn\u2019t load your trends.');
            setTrends(data.trends as Trends);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Couldn\u2019t load your trends.');
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
        if (!response.ok) throw new Error(`Couldn\u2019t generate your ${format} export.`);

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
            setPreviewError(err instanceof Error ? err.message : 'Couldn\u2019t load the preview. Try again?');
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
            setPreviewError(err instanceof Error ? err.message : 'Couldn\u2019t export your document. Try again?');
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
            setPreviewError(err instanceof Error ? err.message : 'Couldn\u2019t prepare the print preview.');
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
        setShowExportTools(false);
    }, [selectedExportType]);

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
                targetExportType: null as DocumentExportType | null,
            };
        }

        if (filterCounts.needs_attention > 0) {
            return {
                title: 'Tighten weak evidence first',
                description: `${filterCounts.needs_attention} experience${filterCounts.needs_attention === 1 ? '' : 's'} are missing core detail. Closing those gaps raises quality across every export format.`,
                actionLabel: 'Review Evidence Queue',
                actionHref: null as string | null,
                targetView: 'evidence' as PortfolioView,
                targetExportType: null as DocumentExportType | null,
            };
        }

        if (filterCounts.ready_to_verify > 0) {
            return {
                title: 'Verify the strongest stories',
                description: `${filterCounts.ready_to_verify} experience${filterCounts.ready_to_verify === 1 ? '' : 's'} already have enough structure to verify and convert into stronger exports.`,
                actionLabel: 'Verify Stories',
                actionHref: null as string | null,
                targetView: 'evidence' as PortfolioView,
                targetExportType: null as DocumentExportType | null,
            };
        }

        if (recommendedView === 'interview') {
            return {
                title: 'Open interview practice',
                description: 'Your evidence base is in good shape. Go straight into the interview workspace and rehearse one story at a time.',
                actionLabel: 'Open Interview',
                actionHref: null as string | null,
                targetView: 'interview' as PortfolioView,
                targetExportType: null as DocumentExportType | null,
            };
        }

        if (recommendedView === 'growth') {
            return {
                title: 'Review growth progress',
                description: 'Your evidence base is stable. Step into growth mode to review momentum, proof, and what should strengthen next.',
                actionLabel: 'Open Growth',
                actionHref: null as string | null,
                targetView: 'growth' as PortfolioView,
                targetExportType: null as DocumentExportType | null,
            };
        }

        return {
            title: `Open ${exportTypeLabels[recommendedExportType]}`,
            description: 'Your evidence base is in good shape. Open the document workspace and tailor the output to the audience you need right now.',
            actionLabel: `Open ${exportTypeLabels[recommendedExportType]}`,
            actionHref: null as string | null,
            targetView: 'export' as PortfolioView,
            targetExportType: recommendedExportType,
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
    }, [filterCounts.ready_to_export, overview, recommendedExportType, statement]);
    const selectedPathwayCard = useMemo(
        () => pathwayCards.find((card) => card.type === selectedExportType) || pathwayCards[0] || null,
        [pathwayCards, selectedExportType]
    );
    const recommendedEvidenceFilter = useMemo<EvidenceFilter>(() => {
        if (filterCounts.needs_attention > 0) return 'needs_attention';
        if (filterCounts.ready_to_verify > 0) return 'ready_to_verify';
        if (filterCounts.ready_to_export > 0) return 'ready_to_export';
        if (filterCounts.verified > 0) return 'verified';
        return 'all';
    }, [filterCounts]);
    const evidenceFocusTitle = useMemo(() => {
        switch (recommendedEvidenceFilter) {
            case 'needs_attention':
                return 'Fill the missing pieces first';
            case 'ready_to_verify':
                return 'Check the strongest unfinished stories';
            case 'ready_to_export':
                return 'Your strongest draft stories are ready';
            case 'verified':
                return 'Your safest proof is already waiting';
            default:
                return 'Work the full evidence queue';
        }
    }, [recommendedEvidenceFilter]);
    const evidenceFocusDescription = useMemo(() => {
        switch (recommendedEvidenceFilter) {
            case 'needs_attention':
                return `${filterCounts.needs_attention} stor${filterCounts.needs_attention === 1 ? 'y is' : 'ies are'} missing core detail. Tighten situation, action, lesson, or outcome before you export anything.`;
            case 'ready_to_verify':
                return `${filterCounts.ready_to_verify} stor${filterCounts.ready_to_verify === 1 ? 'y has' : 'ies have'} enough structure to verify and strengthen.`;
            case 'ready_to_export':
                return `${filterCounts.ready_to_export} stor${filterCounts.ready_to_export === 1 ? 'y is' : 'ies are'} complete enough to reuse in a pack right now.`;
            case 'verified':
                return `${filterCounts.verified} verified stor${filterCounts.verified === 1 ? 'y is' : 'ies are'} ready to reuse or rehearse without much extra work.`;
            default:
                return 'Use the full queue when you want the complete picture of what is weak, ready, or already strong.';
        }
    }, [filterCounts, recommendedEvidenceFilter]);
    const currentEvidenceLaneDescription = useMemo(() => {
        if (evidenceFilter === 'all') {
            return 'Showing every story from weakest evidence to strongest proof so the next fix is easy to spot.';
        }

        const count = filterCounts[evidenceFilter];
        return `Showing ${count} ${evidenceFilterLabels[evidenceFilter].toLowerCase()} stor${count === 1 ? 'y' : 'ies'}.`;
    }, [evidenceFilter, filterCounts]);
    const evidenceSnapshotTitle = useMemo(() => {
        if (filterCounts.needs_attention > 0) {
            return `${filterCounts.needs_attention} stor${filterCounts.needs_attention === 1 ? 'y still needs' : 'ies still need'} shaping`;
        }
        if (filterCounts.ready_to_verify > 0) {
            return `${filterCounts.ready_to_verify} stor${filterCounts.ready_to_verify === 1 ? 'y is' : 'ies are'} close to verification`;
        }
        if (filterCounts.verified > 0) {
            return `${filterCounts.verified} stor${filterCounts.verified === 1 ? 'y is' : 'ies are'} already strong source material`;
        }
        return `${evidenceSummary.total} stor${evidenceSummary.total === 1 ? 'y is' : 'ies are'} in the queue`;
    }, [evidenceSummary.total, filterCounts.needs_attention, filterCounts.ready_to_verify, filterCounts.verified]);
    const evidenceSnapshotDescription = useMemo(() => {
        if (filterCounts.needs_attention > 0) {
            return 'Start with the weakest stories first. A single missing block or clearer proof detail usually unlocks the rest of the queue.';
        }
        if (filterCounts.ready_to_verify > 0) {
            return 'These stories already have structure. The next step is checking proof instead of reopening everything.';
        }
        if (filterCounts.verified > 0) {
            return 'Your strongest stories are ready to support exports and interview practice, so you can stay focused on reuse.';
        }
        return 'Capture another note when you want more material. The current queue does not need much attention right now.';
    }, [filterCounts.needs_attention, filterCounts.ready_to_verify, filterCounts.verified]);
    const currentWorkspaceDescription = useMemo(() => {
        if (activeView === 'export') {
            return selectedExportType === 'resume'
                ? 'Preview your strongest bullets, then export the pack you want to reuse.'
                : 'Shape the right narrative angle, then export it when the voice feels right.';
        }

        if (activeView === 'evidence') {
            return `${filterCounts[evidenceFilter]} stor${filterCounts[evidenceFilter] === 1 ? 'y is' : 'ies are'} in ${evidenceFilterLabels[evidenceFilter].toLowerCase()} right now.`;
        }

        if (activeView === 'interview') {
            return `${overview?.interviewStories.length || 0} stor${overview?.interviewStories.length === 1 ? 'y is' : 'ies are'} ready to rehearse one at a time.`;
        }

        return 'Review momentum, repeated strengths, and what still needs more proof.';
    }, [activeView, evidenceFilter, filterCounts, overview?.interviewStories.length, selectedExportType]);
    const recentWorkspaceSummary = recentViewLinks.length > 0
        ? recentViewLinks.map((view) => portfolioViewLabels[view]).join(' • ')
        : null;
    const exportToolsLabel = showExportTools ? 'Hide export tools' : 'More export tools';
    const exportToolsDescription = showExportTools
        ? 'Go back to one primary export action.'
        : 'Quick jumps and alternate formats stay here until you want them.';
    const interviewToolsLabel = showInterviewTools ? 'Hide story tools' : 'Story tools';
    const interviewToolsDescription = showInterviewTools
        ? 'Go back to one focused story and one primary practice move.'
        : 'Switch stories or change practice mode without leaving the current answer.';
    const editingDetailsLabel = showEditingDetails ? 'Hide supporting blocks' : 'Supporting blocks';
    const editingDetailsDescription = showEditingDetails
        ? 'Go back to the shortest edit path when you only want the core story blocks.'
        : 'Skills, proof notes, and the remaining story blocks stay here when you want to round the story out.';
    const toggleExportTools = () => {
        const nextValue = !showExportTools;
        setShowExportTools(nextValue);
        void trackEvent({
            eventType: 'portfolio_export_tools_toggled',
            value: nextValue ? 'opened' : 'closed',
            metadata: {
                selectedExportType,
                statementVariant,
                hasPreview: Boolean(exportPreview),
            },
        });
    };
    const toggleInterviewTools = () => {
        const nextValue = !showInterviewTools;
        setShowInterviewTools(nextValue);
        void trackEvent({
            eventType: 'portfolio_interview_tools_toggled',
            value: nextValue ? 'opened' : 'closed',
            metadata: {
                activeStoryEntryId,
                practiceMode,
                practiceReveal,
            },
        });
    };
    const toggleEditingDetails = () => {
        const nextValue = !showEditingDetails;
        setShowEditingDetails(nextValue);
        void trackEvent({
            eventType: 'portfolio_editor_details_toggled',
            value: nextValue ? 'opened' : 'closed',
            metadata: {
                editingEntryId,
            },
        });
    };

    const startEdit = (experience: Experience) => {
        setEditingEntryId(experience.entryId);
        setShowEditingDetails(false);
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
            if (!response.ok) throw new Error(data.message || 'Couldn\u2019t save that experience.');

            setEditingEntryId(null);
            await Promise.all([fetchOverview(), fetchTrends(trendPeriod)]);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Couldn\u2019t save that experience.');
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
            if (!response.ok) throw new Error(data.message || 'Couldn\u2019t update the verification.');

            setOverview((prev) => prev ? ({
                ...prev,
                experiences: prev.experiences.map((item) =>
                    item.entryId === experience.entryId ? { ...item, verified: !item.verified } : item
                ),
            }) : prev);
            await fetchTrends(trendPeriod);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Couldn\u2019t update the verification.');
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
                        title={selectedExportType === 'resume' ? 'Choose your resume pack' : 'Choose your statement pack'}
                        description="Pick the pack you want first. Preview and export controls stay on the right when you are ready."
                    />

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
                                            : 'workspace-soft-panel'
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className={`rounded-2xl border p-3 ${isActive || isRecommended ? 'border-primary/30 bg-primary/10 text-primary' : 'workspace-icon-badge'}`}>
                                            <Icon size={18} aria-hidden="true" />
                                        </div>
                                        {isRecommended && <TagPill tone="primary">Recommended</TagPill>}
                                    </div>
                                    <h3 className="workspace-heading mt-4 text-lg font-semibold">{title}</h3>
                                    <p className="mt-2 text-sm leading-6 text-ink-secondary">{description}</p>
                                    <div className="mt-4 space-y-1">
                                        <p className="text-sm text-[rgb(var(--text-primary))]">{readiness}</p>
                                        <p className="text-xs text-ink-muted">{secondary}</p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {selectedPathwayCard && (
                        <div className="workspace-panel rounded-[30px] p-5">
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-xs uppercase tracking-[0.14em] text-ink-muted">Chosen pack</p>
                                    {selectedPathwayCard.isRecommended && <TagPill tone="primary">Recommended next</TagPill>}
                                    {selectedExportType === 'statement' && <TagPill>{statementVariantLabels[statementVariant]} angle</TagPill>}
                                </div>
                                <h3 className="workspace-heading mt-2 text-2xl font-semibold">{selectedPathwayCard.title}</h3>
                                <p className="mt-2 text-sm leading-7 text-ink-secondary">{selectedPathwayCard.description}</p>
                            </div>

                            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                <div className="workspace-soft-panel rounded-2xl p-4">
                                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">Ready now</p>
                                    <p className="workspace-heading mt-2 text-sm font-semibold">{selectedPathwayCard.readiness}</p>
                                </div>
                                <div className="workspace-soft-panel rounded-2xl p-4">
                                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">Best fit</p>
                                    <p className="mt-2 text-sm leading-6 text-[rgb(var(--text-primary))]">{selectedPathwayCard.secondary}</p>
                                </div>
                            </div>

                            {selectedExportType === 'statement' && (
                                <div className="workspace-panel mt-4 rounded-[26px] p-4">
                                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                        <div className="max-w-xl">
                                            <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Statement angle</p>
                                            <h4 className="workspace-heading mt-2 text-lg font-semibold">{statementVariantLabels[statementVariant]}</h4>
                                            <p className="mt-2 text-sm leading-7 text-ink-secondary">
                                                Change the angle here whenever you want the preview to lean more general, more college-ready, or more job-ready.
                                            </p>
                                        </div>
                                        <TagPill tone="primary">Updates preview</TagPill>
                                    </div>

                                    <div className="mt-4 grid gap-3 sm:grid-cols-3" aria-label="Choose the statement angle" role="group">
                                        {statementVariants.map((variant) => {
                                            const isActive = statementVariant === variant;

                                            return (
                                                <button
                                                    key={variant}
                                                    type="button"
                                                    onClick={() => setStatementVariant(variant)}
                                                    aria-pressed={isActive}
                                                    className={`rounded-2xl border px-4 py-4 text-left transition-colors ${
                                                        isActive
                                                            ? 'border-primary/35 bg-primary/12'
                                                            : 'workspace-soft-panel'
                                                    }`}
                                                >
                                                    <span className="workspace-heading block text-sm font-semibold">
                                                        {statementVariantLabels[variant]}
                                                    </span>
                                                    <span className="mt-2 block text-xs leading-6 text-ink-secondary">
                                                        {statementVariantDescriptions[variant]}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>

                                    <div aria-live="polite" className="workspace-soft-panel mt-4 rounded-2xl p-4">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Selected angle</p>
                                            <TagPill>{statementVariantLabels[statementVariant]}</TagPill>
                                        </div>
                                        <p className="mt-3 text-sm leading-7 text-ink-secondary">
                                            {hasValue(statement)
                                                ? `${statement.trim().slice(0, 220)}${statement.trim().length > 220 ? '...' : ''}`
                                                : 'Build a little more evidence and profile direction to generate a stronger statement draft.'}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </AppPanel>
            </div>

            <AppPanel
                id="portfolio-export-preview-panel"
                className="space-y-4 xl:sticky xl:top-28"
                aria-labelledby="portfolio-export-preview-heading"
            >
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Preview</p>
                        <h2 id="portfolio-export-preview-heading" className="workspace-heading mt-1 text-2xl font-semibold">
                            {exportTypeLabels[selectedExportType]}
                        </h2>
                        <p className="mt-1 text-sm text-ink-secondary">{exportTypeDescriptions[selectedExportType]}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <TagPill tone="primary">Print-ready preview</TagPill>
                        {selectedExportType === 'statement' && <TagPill>{statementVariantLabels[statementVariant]}</TagPill>}
                    </div>
                </div>

                <div className="paper-preview-shell overflow-hidden rounded-[32px] border border-[rgba(var(--paper-border),0.92)] shadow-xl">
                    <div className="paper-preview-topbar flex items-center justify-between gap-3 px-4 py-3">
                        <div>
                            <p className="paper-preview-kicker">Preview file</p>
                            <h3 className="paper-preview-title mt-1 text-sm font-semibold">
                                {exportPreview?.fileName || `${exportTypeLabels[selectedExportType]} Preview`}
                            </h3>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {isPreviewLoading ? (
                                <TagPill tone="primary">Refreshing</TagPill>
                            ) : previewError ? (
                                <TagPill tone="muted">Preview issue</TagPill>
                            ) : (
                                <TagPill>Ready</TagPill>
                            )}
                            <TagPill>HTML</TagPill>
                        </div>
                    </div>

                    <div id="portfolio-export-preview" className="paper-preview-canvas relative min-h-[30rem]">
                        {isPreviewLoading && (
                            <div className="paper-preview-overlay absolute inset-0 z-10 flex items-center justify-center">
                                <div className="paper-preview-spinner h-7 w-7 animate-spin rounded-full" />
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
                                <div className="paper-preview-empty-card rounded-2xl p-4 shadow-sm">
                                    <FiUploadCloud size={20} aria-hidden="true" />
                                </div>
                                <h3 className="paper-preview-title mt-4 text-lg font-semibold">Open a pack to preview it</h3>
                                <p className="paper-preview-copy mt-2 max-w-sm text-sm">
                                    Choose a pack on the left to load a document-style preview before you download anything.
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                    <div id="portfolio-export-actions" className="workspace-panel space-y-3 rounded-[28px] p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Export</p>
                                <h3 className="workspace-heading mt-2 text-lg font-semibold">
                                    {selectedExportType === 'resume' ? 'Download the resume pack' : 'Download the statement pack'}
                                </h3>
                                <p className="mt-2 text-sm leading-7 text-ink-secondary">
                                    {selectedExportType === 'resume'
                                        ? 'Start with the print-ready version if you want the cleanest copy to reuse or share.'
                                        : 'Start with the print-ready version when this angle feels close and you want a polished draft.'}
                                </p>
                            </div>
                            <TagPill tone="primary">Primary action</TagPill>
                    </div>

                    <button
                        type="button"
                        onClick={() => {
                            void downloadExport(selectedExportType, 'html');
                        }}
                        disabled={downloadingKey === `${selectedExportType}:html`}
                        className="workspace-button-primary inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-60"
                    >
                        <FiDownload size={15} aria-hidden="true" />
                        {downloadingKey === `${selectedExportType}:html` ? 'Preparing print-ready pack...' : 'Download Print-Ready Pack'}
                    </button>

                    <button
                        type="button"
                        onClick={toggleExportTools}
                        aria-expanded={showExportTools}
                        aria-controls="portfolio-export-tools"
                        className="workspace-soft-panel flex w-full items-start justify-between gap-3 rounded-2xl px-4 py-3 text-left transition-colors"
                    >
                        <span className="min-w-0">
                            <span className="block text-xs uppercase tracking-[0.12em] text-ink-muted">More export tools</span>
                            <span className="workspace-heading mt-2 block text-base font-semibold">{exportToolsLabel}</span>
                            <span className="mt-2 block text-sm leading-7 text-ink-secondary">{exportToolsDescription}</span>
                        </span>
                        <span className="workspace-icon-badge rounded-xl p-2 text-ink-secondary">
                            {showExportTools ? <FiX size={16} aria-hidden="true" /> : <FiTool size={16} aria-hidden="true" />}
                        </span>
                    </button>

                    {showExportTools && (
                        <div id="portfolio-export-tools" className="space-y-4">
                            <div className="workspace-soft-panel rounded-2xl p-4">
                                <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Preview shortcuts</p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    <a
                                        href="#portfolio-export-preview-panel"
                                        className="workspace-pill-muted inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] transition-colors"
                                    >
                                        <FiEye size={13} aria-hidden="true" />
                                        Back to preview
                                    </a>
                                    {selectedExportType === 'statement' && (
                                        <TagPill tone="primary">{statementVariantLabels[statementVariant]} angle</TagPill>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        void downloadExport(selectedExportType, 'markdown');
                                    }}
                                    disabled={downloadingKey === `${selectedExportType}:markdown`}
                                    className="workspace-button-outline inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-60"
                                >
                                    <FiFileText size={15} aria-hidden="true" />
                                    {downloadingKey === `${selectedExportType}:markdown` ? 'Preparing Markdown...' : 'Download Markdown'}
                                </button>
                                <button
                                    type="button"
                                    onClick={printSelectedExport}
                                    disabled={downloadingKey === `${selectedExportType}:print`}
                                    className="workspace-button-outline inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-60"
                                >
                                    <FiPrinter size={15} aria-hidden="true" />
                                    {downloadingKey === `${selectedExportType}:print` ? 'Preparing PDF...' : 'Print / Save PDF'}
                                </button>
                            </div>
                        </div>
                    )}
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
                    title="Work one evidence lane at a time"
                    description="Start with the clearest lane. The rest of the filters and shortcuts stay tucked away until you need them."
                    actionLabel="Quick Capture"
                    actionHref={captureHref}
                />

                <div className="workspace-soft-panel rounded-[28px] p-4">
                    <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Queue snapshot</p>
                    <h3 className="workspace-heading mt-2 text-lg font-semibold">{evidenceSnapshotTitle}</h3>
                    <p className="mt-2 max-w-3xl text-sm leading-7 text-ink-secondary">{evidenceSnapshotDescription}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                        <TagPill>{evidenceSummary.total} scored</TagPill>
                                <TagPill tone={filterCounts.needs_attention > 0 ? 'muted' : 'default'}>
                                    {filterCounts.needs_attention} need detail
                                </TagPill>
                        <TagPill>{filterCounts.ready_to_verify} close to verify</TagPill>
                        <TagPill tone="primary">{filterCounts.verified} verified</TagPill>
                        <TagPill>{evidenceSummary.avgScore}% average story quality</TagPill>
                    </div>
                </div>

                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]">
                    <div className="rounded-[28px] border border-primary/25 bg-primary/12 p-4">
                        <div className="flex items-start gap-3">
                            <div className="rounded-2xl border border-primary/30 bg-primary/15 p-3 text-primary">
                                <FiFlag size={18} aria-hidden="true" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs uppercase tracking-[0.12em] text-primary/80">Best lane now</p>
                                <h3 className="workspace-heading mt-2 text-lg font-semibold">{evidenceFocusTitle}</h3>
                                <p className="mt-2 text-sm leading-7 text-ink-secondary">{evidenceFocusDescription}</p>
                            </div>
                        </div>
                    </div>

                    <div className="workspace-panel rounded-[28px] p-4">
                        <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Current lane</p>
                        <h3 className="workspace-heading mt-2 text-lg font-semibold">{evidenceFilterLabels[evidenceFilter]}</h3>
                        <p className="mt-2 text-sm leading-7 text-ink-secondary">{currentEvidenceLaneDescription}</p>
                    </div>
                </div>

                <div className="workspace-panel rounded-[24px] p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                            <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Switch lane</p>
                            <p className="mt-2 text-sm leading-7 text-ink-secondary">
                                Pick the evidence slice you want without opening another control panel first.
                            </p>
                        </div>
                        <TagPill tone="primary">Recommended: {evidenceFilterLabels[recommendedEvidenceFilter]}</TagPill>
                    </div>
                    <ActionBar className="mt-4 gap-2 overflow-x-auto">
                        {evidenceFilters.map((filter) => (
                            <button
                                key={filter}
                                type="button"
                                onClick={() => setEvidenceFilter(filter)}
                                aria-pressed={evidenceFilter === filter}
                                className={`rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] whitespace-nowrap transition-colors ${
                                    evidenceFilter === filter
                                        ? 'bg-primary/15 text-primary'
                                        : 'workspace-button-ghost text-ink-secondary'
                                }`}
                            >
                                {evidenceFilterLabels[filter]} ({filterCounts[filter]})
                            </button>
                        ))}
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
                        const nextMissingField = completeness.missingFields[0] || null;
                        const readinessLabel = completeness.readyForExport
                            ? 'Ready to use'
                            : completeness.readyForVerification
                                ? 'Almost ready'
                                : `${completeness.missingFields.length} block${completeness.missingFields.length === 1 ? '' : 's'} still open`;
                        const focusTitle = nextMissingField
                            ? `Best next block: ${EVIDENCE_FIELD_LABELS[nextMissingField]}`
                            : !experience.verified
                                ? 'Best next move: verify this story'
                                : 'Best next move: keep this story reusable';
                        const focusDescription = (() => {
                            if (nextMissingField === 'situation') return 'Add the setup first so the rest of the story makes sense right away.';
                            if (nextMissingField === 'action') return 'Name what you actually did so the story sounds owned and concrete.';
                            if (nextMissingField === 'lesson') return 'Write the takeaway so this moment becomes reusable in future prompts.';
                            if (nextMissingField === 'outcome') return 'Capture what changed or improved so the story has a clean finish.';
                            if (nextMissingField === 'skills') return 'Add one to three skills so this story can travel into resume and statement drafts.';
                            if (!experience.verified) return 'The core blocks are filled. Add any last proof details, then verify it when it feels solid.';
                            return 'This one is already strong. Only tighten the label or details if you want a cleaner version later.';
                        })();
                        const primaryActionLabel = nextMissingField
                            ? `Refine ${EVIDENCE_FIELD_LABELS[nextMissingField]}`
                            : 'Continue story';

                        return (
                            <article
                                key={experience.entryId}
                                className="workspace-soft-panel rounded-[28px] p-4 transition-colors"
                            >
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                    <div className="min-w-0 space-y-3">
                                        <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.12em] text-ink-muted">
                                            <span>{formatShortDate(experience.createdAt)}</span>
                                            <span className="text-ink-muted/40">/</span>
                                            <span>{formatRelativeTime(experience.createdAt)}</span>
                                        </div>
                                        <div>
                                            <h3 className="workspace-heading text-lg font-semibold">{experience.title || 'Untitled experience'}</h3>
                                            <p className="mt-2 max-w-3xl text-sm leading-7 text-ink-secondary">
                                                {primarySnippet || 'Add outcome, lesson, and skill detail so this story is ready for export.'}
                                            </p>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            <TagPill tone={stateTone}>{evidenceFilterLabels[state]}</TagPill>
                                            <TagPill>{readinessLabel}</TagPill>
                                        </div>
                                        <div className="workspace-panel rounded-[22px] p-3">
                                            <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Next move</p>
                                            <p className="workspace-heading mt-2 text-sm font-semibold">{focusTitle}</p>
                                            <p className="mt-2 text-sm leading-7 text-ink-secondary">{focusDescription}</p>
                                        </div>
                                    </div>

                                    <div className="grid min-w-[15rem] gap-2 lg:w-[18rem]">
                                        <button
                                            type="button"
                                            onClick={() => startEdit(experience)}
                                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/12 px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-primary transition-colors hover:bg-primary/20"
                                        >
                                            <FiEdit2 size={14} aria-hidden="true" />
                                            {primaryActionLabel}
                                        </button>

                                        <div className="workspace-panel rounded-2xl p-4">
                                            <div className="flex flex-wrap items-start justify-between gap-2">
                                                <div>
                                                    <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Proof read</p>
                                                    <p className="workspace-heading mt-2 text-sm font-semibold">
                                                        {completeness.missingFields.length > 0
                                                            ? `${completeness.missingFields.length} block${completeness.missingFields.length === 1 ? '' : 's'} still open`
                                                            : experience.verified
                                                                ? 'Verified and reusable'
                                                                : 'Core blocks filled'}
                                                    </p>
                                                </div>
                                                <TagPill>{completeness.score}% complete</TagPill>
                                            </div>

                                            <div className="mt-3 flex flex-wrap gap-2">
                                                <TagPill>{formatRatioPercent(experience.confidence || 0)} confidence</TagPill>
                                                {experience.verified && <TagPill tone="primary">Verified story</TagPill>}
                                                {completeness.missingFields.length === 0 && !experience.verified && (
                                                    <TagPill tone="primary">Core blocks filled</TagPill>
                                                )}
                                            </div>

                                            {completeness.missingFields.length > 0 && (
                                                <div className="mt-3">
                                                    <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Still open</p>
                                                    <div className="mt-2 flex flex-wrap gap-2">
                                                        {completeness.missingFields.map((field) => (
                                                            <TagPill key={field} tone="muted">
                                                                Missing {EVIDENCE_FIELD_LABELS[field]}
                                                            </TagPill>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        void toggleVerified(experience);
                                                    }}
                                                    disabled={updatingEntryId === experience.entryId}
                                                    className="workspace-button-outline inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] disabled:opacity-60"
                                                >
                                                    <FiCheckCircle size={14} aria-hidden="true" />
                                                    {updatingEntryId === experience.entryId
                                                        ? 'Updating...'
                                                        : experience.verified
                                                            ? 'Mark Unverified'
                                                            : 'Verify Story'}
                                                </button>
                                                <Link
                                                    href={sourceHref}
                                                    className="workspace-button-outline inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em]"
                                                >
                                                    <FiArrowRight size={14} aria-hidden="true" />
                                                    Source Entry
                                                </Link>
                                            </div>
                                        </div>
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
        const storyMeta = experienceMetaByEntryId.get(story.entryId) || null;
        const sourceHref = appendReturnTo(`/entry/view?id=${story.entryId}`, currentReturnTo);
        const canGoPrevious = activeIndex > 0;
        const canGoNext = activeIndex < stories.length - 1;
        const storyCountLabel = `Story ${activeIndex + 1} of ${stories.length}`;
        const currentInterviewModeLabel = practiceMode
            ? practiceReveal
                ? 'Compare mode'
                : 'Recall mode'
            : 'Guided mode';
        const storyAnchorPreview = story.result || story.action || story.situation || 'Use this story as your current interview anchor.';
        const interviewSurfaceHint = practiceMode
            ? practiceReveal
                ? 'Compare your answer against the scaffold, then hide it again when you want another recall pass.'
                : 'Answer from memory first, then reveal the scaffold only when you want a quick check.'
            : 'Use the scaffold to tighten the story first, then switch to recall mode when it feels ready.';
        const interviewPrimaryAction = practiceMode
            ? practiceReveal
                ? {
                    label: 'Hide scaffold',
                    description: 'Go back to recall mode and try the same story from memory again.',
                    onClick: () => setPracticeReveal(false),
                }
                : {
                    label: 'Reveal scaffold',
                    description: 'Try the answer out loud first, then compare it with the structured STAR version.',
                    onClick: () => setPracticeReveal(true),
                }
            : {
                label: 'Practice from memory',
                description: 'Start in recall mode so you can rehearse the story before checking the scaffold.',
                onClick: () => setPracticeMode(true),
            };

        return (
            <div className="grid gap-6 xl:grid-cols-[290px_minmax(0,1fr)]">
                <AppPanel className="space-y-4">
                    <SectionHeader
                        kicker="Interview"
                        title="Stay with one story at a time"
                        description="Keep one story in focus. Open the rest only when you want to switch."
                    />

                    <div className="workspace-soft-panel rounded-[28px] p-4">
                        <div className="flex flex-wrap gap-2">
                            <TagPill>{storyCountLabel}</TagPill>
                            <TagPill tone={experience?.verified ? 'primary' : 'default'}>
                                {experience?.verified ? 'Verified source' : 'Needs verification'}
                            </TagPill>
                            {storyMeta && <TagPill>{evidenceFilterLabels[storyMeta.state]}</TagPill>}
                        </div>
                        <h3 className="workspace-heading mt-2 text-lg font-semibold">{story.title}</h3>
                        <p className="mt-2 text-sm leading-7 text-ink-secondary">
                            {storyAnchorPreview.length > 140 ? `${storyAnchorPreview.slice(0, 140)}...` : storyAnchorPreview}
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={toggleInterviewTools}
                        aria-expanded={showInterviewTools}
                        aria-controls="portfolio-interview-tools"
                        className="workspace-soft-panel flex w-full items-start justify-between gap-3 rounded-2xl px-4 py-3 text-left transition-colors"
                    >
                        <span className="min-w-0">
                            <span className="block text-xs uppercase tracking-[0.12em] text-ink-muted">More tools</span>
                            <span className="workspace-heading mt-2 block text-base font-semibold">{interviewToolsLabel}</span>
                            <span className="mt-2 block text-sm leading-7 text-ink-secondary">{interviewToolsDescription}</span>
                        </span>
                        <span className="workspace-icon-badge rounded-xl p-2 text-ink-secondary">
                            {showInterviewTools ? <FiX size={16} aria-hidden="true" /> : <FiGrid size={16} aria-hidden="true" />}
                        </span>
                    </button>

                    {showInterviewTools && (
                        <div id="portfolio-interview-tools" className="space-y-4">
                            <div className="workspace-panel rounded-[26px] p-4">
                                <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Switch story</p>
                                <div className="mt-3 space-y-2">
                                    {stories.map((item, index) => (
                                        <button
                                            key={item.entryId}
                                            type="button"
                                            onClick={() => {
                                                setActiveStoryEntryId(item.entryId);
                                                setShowInterviewTools(false);
                                            }}
                                            className={`w-full rounded-2xl border px-4 py-3 text-left transition-colors ${
                                                item.entryId === story.entryId
                                                    ? 'border-primary/30 bg-primary/12'
                                                    : 'workspace-soft-panel'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="workspace-heading truncate text-sm font-semibold">{item.title}</p>
                                                    <p className="mt-1 text-xs uppercase tracking-[0.12em] text-ink-muted">
                                                        Story {index + 1}
                                                    </p>
                                                </div>
                                                {experienceMetaByEntryId.get(item.entryId)?.state === 'verified' && <TagPill tone="primary">Verified</TagPill>}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="workspace-panel rounded-[26px] p-4">
                                <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Practice controls</p>
                                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setPracticeMode(false);
                                            setPracticeReveal(false);
                                        }}
                                        aria-pressed={!practiceMode}
                                        className={`rounded-2xl border px-4 py-3 text-left transition-colors ${
                                            !practiceMode
                                                ? 'border-primary/35 bg-primary/12'
                                                : 'workspace-soft-panel'
                                        }`}
                                    >
                                        <span className="workspace-heading block text-sm font-semibold">Guided</span>
                                        <span className="mt-2 block text-xs leading-6 text-ink-secondary">
                                            Keep the scaffold open while you tighten the story shape.
                                        </span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setPracticeMode(true);
                                            setPracticeReveal(false);
                                        }}
                                        aria-pressed={practiceMode}
                                        className={`rounded-2xl border px-4 py-3 text-left transition-colors ${
                                            practiceMode
                                                ? 'border-primary/35 bg-primary/12'
                                                : 'workspace-soft-panel'
                                        }`}
                                    >
                                        <span className="workspace-heading block text-sm font-semibold">Recall</span>
                                        <span className="mt-2 block text-xs leading-6 text-ink-secondary">
                                            Hide the scaffold first, then reveal it only when you want a check.
                                        </span>
                                    </button>
                                </div>
                                <ActionBar className="mt-3">
                                    <button
                                        type="button"
                                        onClick={() => canGoPrevious && setActiveStoryEntryId(stories[activeIndex - 1]?.entryId || story.entryId)}
                                        disabled={!canGoPrevious}
                                        className="workspace-button-ghost inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-ink-secondary disabled:opacity-40"
                                    >
                                        <FiChevronLeft size={14} aria-hidden="true" />
                                        Prev
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => canGoNext && setActiveStoryEntryId(stories[activeIndex + 1]?.entryId || story.entryId)}
                                        disabled={!canGoNext}
                                        className="workspace-button-ghost inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-ink-secondary disabled:opacity-40"
                                    >
                                        Next
                                        <FiChevronRight size={14} aria-hidden="true" />
                                    </button>
                                </ActionBar>
                            </div>
                        </div>
                    )}
                </AppPanel>

                <div className="space-y-4">
                    <AppPanel className="space-y-4">
                        <div className="space-y-3">
                            <div>
                                <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Focused Story</p>
                                <h2 className="workspace-heading mt-1 text-2xl font-semibold">{story.title}</h2>
                                <p className="mt-2 text-sm leading-7 text-ink-secondary">
                                    {interviewSurfaceHint}
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <TagPill tone="primary">{currentInterviewModeLabel}</TagPill>
                            {(experience?.skills || []).slice(0, 4).map((skill) => (
                                <TagPill key={skill}>{skill}</TagPill>
                            ))}
                            {hasValue(experience?.lesson) && <TagPill tone="muted">{experience?.lesson}</TagPill>}
                        </div>

                        <div className="workspace-soft-panel rounded-2xl p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">Practice plan</p>
                            <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                <p className="max-w-2xl text-sm leading-7 text-[rgb(var(--text-primary))]">{interviewPrimaryAction.description}</p>
                                <button
                                    type="button"
                                    onClick={interviewPrimaryAction.onClick}
                                    className="workspace-button-primary inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em]"
                                >
                                    {interviewPrimaryAction.label}
                                    <FiArrowRight size={14} aria-hidden="true" />
                                </button>
                            </div>
                        </div>

                    </AppPanel>

                    <AppPanel className="space-y-4">
                        {practiceMode && !practiceReveal ? (
                            <div className="workspace-panel rounded-[28px] p-6 text-center">
                                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/30 bg-primary/12 text-primary">
                                    <FiMessageSquare size={20} aria-hidden="true" />
                                </div>
                                <h3 className="workspace-heading mt-4 text-xl font-semibold">Answer out loud first</h3>
                                <p className="mt-2 text-sm leading-7 text-ink-secondary">
                                    Keep the scaffold hidden until you want a quick check against the structured version.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => setPracticeReveal(true)}
                                    className="mt-5 inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/12 px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-primary transition-colors hover:bg-primary/20"
                                >
                                    <FiEye size={14} aria-hidden="true" />
                                    Show scaffold
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
                                    <div key={section.label} className="workspace-soft-panel rounded-[26px] p-4">
                                        <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">{section.label}</p>
                                        <p className="mt-3 text-sm leading-7 text-ink-secondary">{section.value || 'Add more evidence detail to strengthen this section.'}</p>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="flex flex-wrap gap-2">
                            <Link
                                href={sourceHref}
                                className="workspace-button-outline inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em]"
                            >
                                <FiArrowRight size={14} aria-hidden="true" />
                                Open Source Entry
                            </Link>
                            {experience && (
                                <button
                                    type="button"
                                    onClick={() => startEdit(experience)}
                                    className="workspace-button-outline inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em]"
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
        const topSkillsPreview = (overview?.topSkills || []).slice(0, 6);
        const topLessonsPreview = (overview?.topLessons || []).slice(0, 6);
        const lensReadiness = overview?.profileContext?.completionScore || 0;
        const growthFocus = lensReadiness < 60
            ? {
                title: 'Tune your story lens',
                description: 'Your direction settings are still light. Tightening them will make the rest of the progress view more useful.',
                actionLabel: 'Tune story lens',
                actionHref: profileHref,
                actionView: null as PortfolioView | null,
            }
            : evidenceSummary.avgScore < 70
                ? {
                    title: 'Strengthen story quality next',
                    description: `Average story quality is ${evidenceSummary.avgScore}%. Sharpening a few core stories will improve every export and interview answer.`,
                    actionLabel: 'Open Evidence Queue',
                    actionHref: null as string | null,
                    actionView: 'evidence' as PortfolioView,
                }
                : verifiedRate < 0.5
                    ? {
                        title: 'Verify more proof',
                        description: `${formatRatioPercent(verifiedRate)} of stories are verified. Moving a few stronger stories into verified proof will make this system more reliable.`,
                        actionLabel: 'Open Evidence Queue',
                        actionHref: null as string | null,
                        actionView: 'evidence' as PortfolioView,
                    }
                    : (overview?.topSkills?.[0]
                        ? {
                            title: `${overview.topSkills[0]} is surfacing most`,
                            description: 'Your strongest repeated skill is getting clearer. Rehearse or reuse the stories that prove it best.',
                            actionLabel: 'Open Interview',
                            actionHref: null as string | null,
                            actionView: 'interview' as PortfolioView,
                        }
                        : {
                            title: 'Your story system is getting stronger',
                            description: 'Keep the momentum small and consistent. The main trendline is already giving you a useful read.',
                            actionLabel: 'Open Stories',
                            actionHref: null as string | null,
                            actionView: 'export' as PortfolioView,
                        });

        return (
            <div className="space-y-6">
                <AppPanel className="space-y-5">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <SectionHeader
                            kicker="Progress"
                            title="Keep growth readable"
                            description="Start with one headline read, one main trendline, and a small set of supporting context cards."
                        />
                        <ActionBar>
                            {(['week', 'month'] as const).map((period) => (
                                <button
                                    key={period}
                                    type="button"
                                    onClick={() => setTrendPeriod(period)}
                                    aria-pressed={trendPeriod === period}
                                    className={`rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] transition-colors ${
                                        trendPeriod === period
                                            ? 'bg-primary/15 text-primary'
                                            : 'workspace-button-ghost text-ink-secondary'
                                    }`}
                                >
                                    {period}
                                </button>
                            ))}
                        </ActionBar>
                    </div>

                    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.9fr)]">
                        <div className="rounded-[28px] border border-primary/25 bg-primary/12 p-4">
                            <div className="flex items-start gap-3">
                                <div className="rounded-2xl border border-primary/30 bg-primary/15 p-3 text-primary">
                                    <FiTrendingUp size={18} aria-hidden="true" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs uppercase tracking-[0.12em] text-primary/80">Best next move</p>
                                    <h3 className="workspace-heading mt-2 text-lg font-semibold">{growthFocus.title}</h3>
                                    <p className="mt-2 text-sm leading-7 text-ink-secondary">{growthFocus.description}</p>
                                </div>
                            </div>
                            <div className="mt-4">
                                {growthFocus.actionView ? (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const targetView = growthFocus.actionView;
                                            if (!targetView) return;
                                            switchView(targetView);
                                        }}
                                        className="workspace-button-primary inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em]"
                                    >
                                        {growthFocus.actionLabel}
                                        <FiArrowRight size={14} aria-hidden="true" />
                                    </button>
                                ) : (
                                    <Link
                                        href={growthFocus.actionHref || captureHref}
                                        className="workspace-button-primary inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em]"
                                    >
                                        {growthFocus.actionLabel}
                                        <FiArrowRight size={14} aria-hidden="true" />
                                    </Link>
                                )}
                            </div>
                        </div>

                        <div className="workspace-panel rounded-[28px] p-4">
                            <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Current read</p>
                            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                <div className="workspace-soft-panel rounded-2xl p-4">
                                    <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Verified rate</p>
                                    <p className="workspace-heading mt-2 text-lg font-semibold">{formatRatioPercent(verifiedRate)}</p>
                                </div>
                                <div className="workspace-soft-panel rounded-2xl p-4">
                                    <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Story quality</p>
                                    <p className="workspace-heading mt-2 text-lg font-semibold">{evidenceSummary.avgScore}%</p>
                                </div>
                            </div>
                            <p className="mt-4 text-sm leading-7 text-ink-secondary">
                                Lens readiness is {lensReadiness}%, and {overview?.topSkills.length || 0} repeated skill{(overview?.topSkills.length || 0) === 1 ? '' : 's'} are surfacing so far.
                            </p>
                        </div>
                    </div>

                    <div className="grid gap-3 xl:grid-cols-3">
                        <div className="workspace-panel rounded-[28px] p-4">
                            <div className="flex items-center gap-2 text-primary">
                                <FiFlag size={16} aria-hidden="true" />
                                <p className="text-xs uppercase tracking-[0.12em]">Current lens</p>
                            </div>
                            <div className="mt-4 grid gap-3">
                                <div className="workspace-soft-panel rounded-2xl p-4">
                                    <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Primary goal</p>
                                    <p className="workspace-heading mt-2 text-sm font-semibold">{overview?.profileContext?.primaryGoal || 'Not set yet'}</p>
                                </div>
                                <div className="workspace-soft-panel rounded-2xl p-4">
                                    <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Focus area</p>
                                    <p className="workspace-heading mt-2 text-sm font-semibold">{overview?.profileContext?.focusArea || 'Not set yet'}</p>
                                </div>
                                <div className="workspace-soft-panel rounded-2xl p-4">
                                    <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Capture style</p>
                                    <p className="workspace-heading mt-2 text-sm font-semibold">{formatLabel(overview?.profileContext?.writingPreference)}</p>
                                </div>
                            </div>
                            <div className="mt-4 flex flex-wrap gap-2">
                                {outputGoals.length > 0 ? outputGoals.map((goal) => <TagPill key={goal}>{formatLabel(goal)}</TagPill>) : <TagPill tone="muted">Set output goals</TagPill>}
                            </div>
                            <Link
                                href={profileHref}
                                className="workspace-button-outline mt-4 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em]"
                            >
                                <FiTool size={14} aria-hidden="true" />
                                Tune story lens
                            </Link>
                        </div>

                        <div className="workspace-panel rounded-[28px] p-4">
                            <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Repeated material</p>
                            <div className="mt-4 space-y-4">
                                <div>
                                    <p className="workspace-heading text-sm font-semibold">Skills surfacing most</p>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {topSkillsPreview.length > 0 ? topSkillsPreview.map((skill) => (
                                            <TagPill key={skill} tone="primary">{skill}</TagPill>
                                        )) : (
                                            <TagPill tone="muted">Capture a few more stories</TagPill>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <p className="workspace-heading text-sm font-semibold">Lessons worth carrying forward</p>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {topLessonsPreview.length > 0 ? topLessonsPreview.map((lesson) => (
                                            <TagPill key={lesson}>{lesson}</TagPill>
                                        )) : (
                                            <TagPill tone="muted">Patterns will show up here</TagPill>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="workspace-panel rounded-[28px] p-4">
                            <div className="flex items-center gap-2 text-primary">
                                <FiClock size={16} aria-hidden="true" />
                                <p className="text-xs uppercase tracking-[0.12em]">Return points</p>
                            </div>
                            <p className="mt-4 text-sm leading-7 text-ink-secondary">
                                Jump back to the studio areas you used most recently or resume the last saved path.
                            </p>
                            <div className="mt-4 flex flex-wrap gap-2">
                                {recentViewLinks.length > 0 ? recentViewLinks.map((view) => (
                                    <button
                                        key={view}
                                        type="button"
                                        onClick={() => switchView(view)}
                                        className="workspace-button-outline rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em]"
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
                                    className="mt-4 inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/12 px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-primary transition-colors hover:bg-primary/20"
                                >
                                    <FiArrowRight size={14} aria-hidden="true" />
                                    Resume {buildResumeLabel(resumeSession)}
                                </button>
                            )}
                        </div>
                    </div>

                </AppPanel>

                <AppPanel className="space-y-5">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Trendline</p>
                            <h3 className="workspace-heading mt-1 text-xl font-semibold">Momentum across the last six windows</h3>
                            <p className="mt-2 text-sm leading-7 text-ink-secondary">
                                This stays as the main growth read, with the surrounding context cards close enough to reference without opening anything else.
                            </p>
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
                                    <div key={point.periodStart} className="workspace-panel rounded-2xl p-4">
                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                            <p className="workspace-heading text-sm font-semibold">{point.periodLabel}</p>
                                            <div className="flex flex-wrap gap-2 text-xs text-ink-muted">
                                                <span>{point.entries} entries</span>
                                                <span>{point.verified} verified</span>
                                                <span>{formatRatioPercent(point.averageConfidence || 0)} confidence</span>
                                            </div>
                                        </div>
                                        <div className="mt-4 space-y-2">
                                            <div>
                                                <div className="mb-1 flex items-center justify-between text-xs uppercase tracking-[0.12em] text-ink-muted">
                                                    <span>Entries</span>
                                                    <span>{point.entries}</span>
                                                </div>
                                                <div className="h-2 rounded-full bg-white/10">
                                                    <div className="h-full rounded-full bg-white/40" style={{ width: entriesWidth }} />
                                                </div>
                                            </div>
                                            <div>
                                                <div className="mb-1 flex items-center justify-between text-xs uppercase tracking-[0.12em] text-ink-muted">
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
            </div>
        );
    };

    const renderEditingDrawer = () => {
        if (!editingEntryId || !editingExperience || !editingDraft) return null;

        const draftCompleteness = getDraftCompleteness(editingDraft);
        const sourceHref = appendReturnTo(`/entry/view?id=${editingExperience.entryId}`, currentReturnTo);
        const fields: Array<{ field: keyof Draft; label: string; placeholder: string; rows?: number; helper: string }> = [
            {
                field: 'title',
                label: 'Title',
                placeholder: 'Give this story a clear label',
                helper: 'Use a short label you will recognize later.',
            },
            {
                field: 'situation',
                label: 'Situation',
                placeholder: 'What context should a reader know first?',
                rows: 4,
                helper: 'Start with the context so the rest of the story lands faster.',
            },
            {
                field: 'action',
                label: 'Action',
                placeholder: 'What did you actually do?',
                rows: 4,
                helper: 'Name what you chose or changed so the story sounds owned.',
            },
            {
                field: 'outcome',
                label: 'Outcome',
                placeholder: 'What changed or improved?',
                rows: 4,
                helper: 'Capture what happened next so the story has a finish.',
            },
            {
                field: 'lesson',
                label: 'Lesson',
                placeholder: 'What should this story teach or prove?',
                rows: 4,
                helper: 'Write the takeaway that makes this reusable later.',
            },
            {
                field: 'skillsText',
                label: 'Skills',
                placeholder: 'communication, leadership, analysis',
                helper: 'Add one to three skills so this story can travel into exports.',
            },
            {
                field: 'notes',
                label: 'Verification Notes',
                placeholder: 'Add evidence notes, metrics, or follow-up proof to verify later.',
                rows: 4,
                helper: 'Drop in proof, metrics, or follow-up details before verifying.',
            },
        ];
        const fieldConfigByKey = new Map(fields.map((fieldConfig) => [fieldConfig.field, fieldConfig]));
        const storyFieldOrder: Array<Extract<keyof Draft, 'situation' | 'action' | 'outcome' | 'lesson'>> = ['situation', 'action', 'outcome', 'lesson'];
        const missingStoryFields = storyFieldOrder.filter((field) => draftCompleteness.missingFields.includes(field as EvidenceField));
        const recommendedEditorField: keyof Draft = missingStoryFields[0]
            || (draftCompleteness.missingFields.includes('skills') ? 'skillsText' : !editingExperience.verified ? 'notes' : 'title');
        const primaryFieldKeySet = new Set<keyof Draft>(['title']);

        primaryFieldKeySet.add(recommendedEditorField);
        if (missingStoryFields.length > 0) {
            missingStoryFields.slice(0, 2).forEach((field) => primaryFieldKeySet.add(field));
        } else if (!draftCompleteness.missingFields.includes('skills') && editingExperience.verified) {
            primaryFieldKeySet.add('lesson');
        }

        const primaryFields = fields.filter(({ field }) => primaryFieldKeySet.has(field));
        const secondaryFields = fields.filter(({ field }) => !primaryFieldKeySet.has(field));
        const secondaryMissingFields = secondaryFields.filter(({ field }) => !hasValue(editingDraft[field]));
        const focusFieldLabel = fieldConfigByKey.get(recommendedEditorField)?.label || 'Title';
        const focusCardTitle = draftCompleteness.missingFields.length > 0
            ? `Best next block: ${focusFieldLabel}`
            : !editingExperience.verified
                ? 'Best next move: add proof or verify'
                : 'Best next move: polish the story label';
        const focusCardBody = (() => {
            if (recommendedEditorField === 'situation') return 'Start with the context so the story has a clear anchor before you polish anything else.';
            if (recommendedEditorField === 'action') return 'Name the action you actually took so this reads like your story, not just something that happened to you.';
            if (recommendedEditorField === 'outcome') return 'Capture what changed, improved, or happened next so the story has a clean finish.';
            if (recommendedEditorField === 'lesson') return 'Write the takeaway this moment proves so it becomes reusable in interviews and exports.';
            if (recommendedEditorField === 'skillsText') return 'Add one to three skills next so this story can travel into resume and statement drafts.';
            if (recommendedEditorField === 'notes') return 'Drop in any proof, metric, or follow-up note you would want before marking this story verified.';
            return 'Give this story a cleaner label so it is easier to find and reuse later.';
        })();
        const statusTitle = draftCompleteness.readyForExport
            ? 'Ready to use'
            : draftCompleteness.readyForVerification
                ? 'Almost ready'
                : `${draftCompleteness.missingFields.length} block${draftCompleteness.missingFields.length === 1 ? '' : 's'} still open`;
        const renderField = ({
            field,
            label,
            placeholder,
            rows,
            helper,
        }: {
            field: keyof Draft;
            label: string;
            placeholder: string;
            rows?: number;
            helper: string;
        }) => (
            <label key={field} className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">
                    {label}
                </span>
                <span className="mb-3 block text-sm leading-6 text-ink-secondary">{helper}</span>
                {rows ? (
                    <textarea
                        value={editingDraft[field]}
                        rows={rows}
                        onChange={(event) => updateDraft(editingExperience.entryId, field, event.target.value)}
                        placeholder={placeholder}
                        className="workspace-input min-h-[7rem] w-full rounded-2xl px-4 py-3 text-sm outline-none transition-colors focus:border-primary/35"
                    />
                ) : (
                    <input
                        value={editingDraft[field]}
                        onChange={(event) => updateDraft(editingExperience.entryId, field, event.target.value)}
                        placeholder={placeholder}
                        className="workspace-input w-full rounded-2xl px-4 py-3 text-sm outline-none transition-colors focus:border-primary/35"
                    />
                )}
            </label>
        );

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
                    onKeyDown={(e) => { if (e.key === 'Escape') setEditingEntryId(null); }}
                >
                    <motion.div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="portfolio-evidence-editor-title"
                        className="workspace-panel flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-[32px] shadow-2xl md:ml-auto md:h-[calc(100vh-2rem)] md:max-w-2xl md:rounded-[32px]"
                        initial={reduceMotion ? { opacity: 1 } : { y: 32, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={reduceMotion ? { opacity: 1 } : { y: 24, opacity: 0 }}
                        transition={{ duration: reduceMotion ? 0 : 0.2 }}
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="flex items-start justify-between gap-4 border-b border-[rgba(var(--paper-border),0.92)] px-5 py-4 md:px-6">
                            <div>
                                <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Story Refinery</p>
                                <h2 id="portfolio-evidence-editor-title" className="workspace-heading mt-1 text-xl font-semibold">
                                    {editingExperience.title || 'Refine story'}
                                </h2>
                                <p className="mt-2 text-sm text-ink-secondary">
                                    Sharpen the evidence here without expanding the main workspace into a long editing thread.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setEditingEntryId(null)}
                                className="workspace-button-outline rounded-xl p-2"
                                aria-label="Close evidence editor"
                            >
                                <FiX size={16} aria-hidden="true" />
                            </button>
                        </div>

                        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 md:px-6">
                            <div className="workspace-panel rounded-[24px] p-4">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                        <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Draft readiness</p>
                                        <p className="workspace-heading mt-1 text-lg font-semibold">{draftCompleteness.score}% complete</p>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <TagPill>{draftCompleteness.presentCount}/{draftCompleteness.totalCount} blocks filled</TagPill>
                                        <TagPill tone={editingExperience.verified ? 'primary' : 'muted'}>
                                            {editingExperience.verified ? 'Verified' : 'Not verified'}
                                        </TagPill>
                                    </div>
                                </div>
                                <div className="mt-4 h-2 rounded-full bg-[rgba(var(--paper-border),0.62)]">
                                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${draftCompleteness.score}%` }} />
                                </div>
                            </div>

                            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_240px]">
                                <div className="rounded-[24px] border border-primary/25 bg-primary/12 p-4">
                                    <p className="text-xs uppercase tracking-[0.12em] text-primary/80">Best next block</p>
                                    <h3 className="workspace-heading mt-2 text-lg font-semibold">{focusCardTitle}</h3>
                                    <p className="mt-2 text-sm leading-7 text-ink-secondary">{focusCardBody}</p>
                                </div>

                                <div className="workspace-panel rounded-[24px] p-4">
                                    <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Current status</p>
                                    <p className="workspace-heading mt-2 text-lg font-semibold">{statusTitle}</p>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {draftCompleteness.missingFields.length > 0 ? draftCompleteness.missingFields.map((field) => (
                                            <TagPill key={field} tone="muted">{EVIDENCE_FIELD_LABELS[field]}</TagPill>
                                        )) : (
                                            <TagPill tone="primary">All core blocks filled</TagPill>
                                        )}
                                    </div>
                                    <p className="mt-3 text-sm leading-7 text-ink-secondary">
                                        {editingExperience.verified
                                            ? 'This story is already verified, so any change here is refinement.'
                                            : 'Keep this pass short. You can verify after the story and proof feel solid.'}
                                    </p>
                                </div>
                            </div>

                            <div className="workspace-panel space-y-4 rounded-[24px] p-4">
                                <div>
                                    <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Start here</p>
                                    <p className="mt-2 text-sm leading-7 text-ink-secondary">
                                        Keep this edit pass short. The highest-value fields stay open first, and the rest of the draft stays tucked away.
                                    </p>
                                </div>
                                <div className="space-y-4">
                                    {primaryFields.map(renderField)}
                                </div>
                            </div>

                            <div className="workspace-panel space-y-3 rounded-[22px] p-3">
                                <button
                                    type="button"
                                    onClick={toggleEditingDetails}
                                    aria-expanded={showEditingDetails}
                                    aria-controls="portfolio-evidence-editor-details"
                                    className="workspace-soft-panel flex w-full items-start justify-between gap-3 rounded-2xl px-4 py-3 text-left transition-colors"
                                >
                                    <span className="min-w-0">
                                        <span className="block text-xs uppercase tracking-[0.12em] text-ink-muted">Supporting blocks</span>
                                        <span className="workspace-heading mt-2 block text-base font-semibold">{editingDetailsLabel}</span>
                                        <span className="mt-2 block text-sm leading-7 text-ink-secondary">{editingDetailsDescription}</span>
                                    </span>
                                    <span className="workspace-icon-badge rounded-xl p-2 text-ink-secondary">
                                        {showEditingDetails ? <FiX size={16} aria-hidden="true" /> : <FiTool size={16} aria-hidden="true" />}
                                    </span>
                                </button>

                                <div className="space-y-3 px-1">
                                    <div className="flex flex-wrap gap-2">
                                        {secondaryFields.map(({ field, label }) => (
                                            <TagPill key={field} tone={hasValue(editingDraft[field]) ? 'default' : 'muted'}>
                                                {label}
                                            </TagPill>
                                        ))}
                                    </div>
                                    <p className="text-sm leading-7 text-ink-secondary">
                                        {secondaryMissingFields.length > 0
                                            ? `${secondaryMissingFields.length} supporting block${secondaryMissingFields.length === 1 ? '' : 's'} still open: ${secondaryMissingFields.map(({ label }) => label).join(', ')}.`
                                            : 'All supporting blocks are filled if you want to polish them further.'}
                                    </p>
                                </div>

                                {showEditingDetails && (
                                    <div id="portfolio-evidence-editor-details" className="grid gap-4 px-1 pb-1 md:grid-cols-2">
                                        {secondaryFields.map(renderField)}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="border-t border-[rgba(var(--paper-border),0.92)] px-5 py-4 md:px-6">
                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                <div className="flex flex-wrap gap-2">
                                    <Link
                                        href={sourceHref}
                                        className="workspace-button-outline inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em]"
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
                                        className="workspace-button-outline inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em]"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            void saveDraft(editingExperience.entryId);
                                        }}
                                        disabled={savingEntryId === editingExperience.entryId}
                                        className="workspace-button-primary inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] disabled:opacity-60"
                                    >
                                        <FiEdit2 size={14} aria-hidden="true" />
                                        {savingEntryId === editingExperience.entryId ? 'Saving...' : 'Save Story'}
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
                    <Spinner size="lg" />
                    <p className="text-sm text-ink-secondary">Getting your saved stories ready...</p>
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
                        className="workspace-button-outline inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em]"
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
    const recommendedWorkspaceLabel = recommendedView === 'export'
        ? exportTypeLabels[recommendedExportType]
        : portfolioViewLabels[recommendedView];
    const storySnapshotTitle = filterCounts.ready_to_export > 0
        ? `${filterCounts.ready_to_export} stor${filterCounts.ready_to_export === 1 ? 'y is' : 'ies are'} ready to reuse`
        : filterCounts.needs_attention > 0
            ? `${filterCounts.needs_attention} stor${filterCounts.needs_attention === 1 ? 'y still needs' : 'ies still need'} shaping`
            : overview.interviewStories.length > 0
                ? `${overview.interviewStories.length} stor${overview.interviewStories.length === 1 ? 'y is' : 'ies are'} ready to rehearse`
                : 'Your saved moments are ready for the next pass';
    const storySnapshotDescription = filterCounts.needs_attention > 0
        ? 'Start with the stories that still need one missing block or one clearer proof detail. The stronger stories can wait.'
        : filterCounts.ready_to_export > 0
            ? 'You already have reusable material here. Keep the focus on exporting or lightly polishing instead of reopening everything.'
            : overview.interviewStories.length > 0
                ? 'The strongest stories are already taking shape, so this is a good moment to rehearse or export instead of digging for more.'
                : 'Capture one more note when you want new material. The rest of the studio can stay quiet for now.';
    const workspaceDestinations = [
        {
            id: 'resume',
            label: 'Resume',
            detail: 'Preview and export',
            icon: FiFileText,
            active: activeView === 'export' && selectedExportType === 'resume',
            recommended: recommendedView === 'export' && recommendedExportType === 'resume',
            onClick: () => {
                void openStudio('resume');
            },
        },
        {
            id: 'statement',
            label: 'Statement',
            detail: 'Choose angle and export',
            icon: FiBookOpen,
            active: activeView === 'export' && selectedExportType === 'statement',
            recommended: recommendedView === 'export' && recommendedExportType === 'statement',
            onClick: () => {
                void openStudio('statement');
            },
        },
        {
            id: 'evidence',
            label: 'Evidence',
            detail: 'Refine and verify',
            icon: FiCheckCircle,
            active: activeView === 'evidence',
            recommended: recommendedView === 'evidence',
            onClick: () => {
                switchView('evidence');
            },
        },
        {
            id: 'interview',
            label: 'Interview',
            detail: 'Preview and practice',
            icon: FiMessageSquare,
            active: activeView === 'interview',
            recommended: recommendedView === 'interview',
            onClick: () => {
                switchView('interview');
            },
        },
        {
            id: 'growth',
            label: 'Growth',
            detail: 'Review progress',
            icon: FiTrendingUp,
            active: activeView === 'growth',
            recommended: recommendedView === 'growth',
            onClick: () => {
                switchView('growth');
            },
        },
    ];

    return (
        <div className="space-y-6 px-1 pb-32 pt-2">
            <AppPanel className="workspace-panel sticky top-20 z-20 overflow-hidden space-y-5">
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 opacity-70"
                    style={{
                        background: 'radial-gradient(circle at top left, rgba(var(--brand), 0.12), transparent 38%)',
                    }}
                />
                <div className="relative grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
                    <div className="space-y-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                                <p className="text-xs uppercase tracking-[0.14em] text-ink-muted">Stories</p>
                                <h1 className="workspace-heading mt-1 text-3xl font-semibold">{NOTIVE_VOICE.stories.title}</h1>
                                <p className="mt-2 max-w-2xl text-sm leading-7 text-ink-secondary">
                                    {NOTIVE_VOICE.stories.description}
                                </p>
                            </div>
                            <div className="workspace-pill-muted inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs uppercase tracking-[0.12em]">
                                <ActiveViewIcon size={14} aria-hidden="true" />
                                Current workspace: {currentWorkspaceLabel}
                            </div>
                        </div>

                        <div className="workspace-soft-panel rounded-[28px] p-4">
                            <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Studio snapshot</p>
                            <h2 className="workspace-heading mt-2 text-lg font-semibold">{storySnapshotTitle}</h2>
                            <p className="mt-2 max-w-2xl text-sm leading-7 text-ink-secondary">{storySnapshotDescription}</p>
                            <div className="mt-4 flex flex-wrap gap-2">
                                <TagPill tone="primary">{filterCounts.ready_to_export} ready to reuse</TagPill>
                                <TagPill tone={filterCounts.needs_attention > 0 ? 'muted' : 'default'}>
                                    {filterCounts.needs_attention} need detail
                                </TagPill>
                                <TagPill>{overview.interviewStories.length} ready to rehearse</TagPill>
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-3">
                        <div className="rounded-[28px] border border-primary/25 bg-primary/12 p-4">
                            <div className="flex items-start gap-3">
                                <div className="rounded-2xl border border-primary/30 bg-primary/15 p-3 text-primary">
                                    <FiZap size={18} aria-hidden="true" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs uppercase tracking-[0.12em] text-primary/80">Best next use</p>
                                    <h2 className="workspace-heading mt-2 text-lg font-semibold">{nextAction.title}</h2>
                                    <p className="mt-2 text-sm leading-7 text-ink-secondary">{nextAction.description}</p>
                                </div>
                            </div>
                            <div className="mt-4">
                                {nextAction.targetView ? (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const targetView = nextAction.targetView;
                                            if (!targetView) return;
                                            if (targetView === 'export' && nextAction.targetExportType) {
                                                void openStudio(nextAction.targetExportType);
                                                return;
                                            }
                                            switchView(targetView);
                                        }}
                                        className="workspace-button-primary inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em]"
                                    >
                                        {nextAction.actionLabel}
                                        <FiArrowRight size={14} aria-hidden="true" />
                                    </button>
                                ) : (
                                    <Link
                                        href={nextAction.actionHref || captureHref}
                                        className="workspace-button-primary inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em]"
                                    >
                                        {nextAction.actionLabel}
                                        <FiArrowRight size={14} aria-hidden="true" />
                                    </Link>
                                )}
                            </div>
                        </div>

                        <div className="workspace-panel rounded-[24px] p-4">
                            <div className="flex flex-wrap items-center gap-2">
                                <div className="workspace-icon-badge rounded-2xl p-2 text-ink-secondary">
                                    <ActiveViewIcon size={16} aria-hidden="true" />
                                </div>
                                <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Current workspace</p>
                                <TagPill>{currentWorkspaceLabel}</TagPill>
                            </div>
                            <p className="mt-3 text-sm leading-7 text-ink-secondary">{currentWorkspaceDescription}</p>
                            {resumeSession && (
                                <div className="mt-4">
                                    <button
                                        type="button"
                                        onClick={resumePreviousSession}
                                        className="workspace-button-outline inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em]"
                                    >
                                        Resume last place
                                        <FiClock size={14} aria-hidden="true" />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="workspace-panel space-y-4 rounded-[22px] p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                            <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Switch workspace</p>
                            <p className="mt-2 text-sm leading-7 text-ink-secondary">
                                Jump straight to the output surface you want without opening another drawer first.
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <TagPill tone="primary">Recommended: {recommendedWorkspaceLabel}</TagPill>
                            {recentWorkspaceSummary && <TagPill tone="muted">Recent: {recentWorkspaceSummary}</TagPill>}
                        </div>
                    </div>

                    <div className="flex gap-2 overflow-x-auto pb-1">
                        {workspaceDestinations.map(({ id, label, detail, icon: Icon, active, recommended, onClick }) => (
                            <button
                                key={id}
                                type="button"
                                onClick={onClick}
                                className={`min-w-[170px] shrink-0 rounded-2xl px-4 py-3 text-left transition-colors ${
                                    active
                                        ? 'workspace-button-primary shadow-lg shadow-primary/20'
                                        : 'workspace-button-outline'
                                }`}
                                title={detail}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <span className="inline-flex min-w-0 items-center gap-3">
                                        <span className={`rounded-xl border p-2 ${active ? 'border-primary/20 bg-primary/15' : 'workspace-icon-badge'}`}>
                                            <Icon size={15} aria-hidden="true" />
                                        </span>
                                        <span className="min-w-0">
                                            <span className="block text-sm font-semibold">{label}</span>
                                            <span className="block text-xs uppercase tracking-[0.12em] opacity-80">{detail}</span>
                                        </span>
                                    </span>
                                    <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                                        active
                                            ? 'bg-white/15'
                                            : recommended
                                                ? 'bg-primary/15 text-primary'
                                                : 'bg-white/10 text-ink-secondary'
                                    }`}>
                                        {active ? 'Current' : recommended ? 'Next' : 'Open'}
                                    </span>
                                </div>
                            </button>
                        ))}
                    </div>

                    <div className="workspace-soft-panel rounded-2xl px-4 py-3">
                        <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Keep the rest tucked away</p>
                        <p className="mt-2 text-sm leading-7 text-ink-secondary">
                            {resumeSession
                                ? 'Resume last place stays in the card above, so switching workspaces can stay a one-tap choice.'
                                : 'Switch workspaces in one tap and keep the rest of the studio tucked away until you need it.'}
                        </p>
                    </div>
                </div>
            </AppPanel>

            {error && (
                <ErrorState
                    title="Couldn\u2019t Load Portfolio"
                    message={error}
                    variant="compact"
                    action={{
                        label: "Try Again",
                        onClick: () => {
                            void fetchOverview();
                            void fetchTrends(trendPeriod);
                        },
                    }}
                />
            )}

            <AnimatePresence mode="wait" initial={false}>
                <motion.div
                    key={activeView}
                    initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -10 }}
                    transition={{ duration: reduceMotion ? 0 : 0.22 }}
                    id="portfolio-active-mode"
                    className="space-y-6"
                >
                    {renderActiveMode()}
                </motion.div>
            </AnimatePresence>

            {renderEditingDrawer()}
        </div>
    );
}
