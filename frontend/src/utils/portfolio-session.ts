export type PortfolioView = 'export' | 'evidence' | 'interview' | 'growth';
export type PortfolioExportType = 'resume' | 'statement' | 'interview' | 'growth';
export type PortfolioStatementVariant = 'standard' | 'college' | 'entry_job';
export type PortfolioEvidenceFilter = 'all' | 'needs_attention' | 'ready_to_verify' | 'ready_to_export' | 'verified';

export type PortfolioSessionState = {
    view: PortfolioView;
    selectedExportType: PortfolioExportType;
    statementVariant: PortfolioStatementVariant;
    evidenceFilter: PortfolioEvidenceFilter;
    lastOpenedStoryId: string | null;
    recentViews: PortfolioView[];
    updatedAt: string;
};

const STORAGE_KEY = 'notive.portfolio.workspace.v2';

const portfolioViews = new Set<PortfolioView>(['export', 'evidence', 'interview', 'growth']);
const exportTypes = new Set<PortfolioExportType>(['resume', 'statement', 'interview', 'growth']);
const statementVariants = new Set<PortfolioStatementVariant>(['standard', 'college', 'entry_job']);
const evidenceFilters = new Set<PortfolioEvidenceFilter>(['all', 'needs_attention', 'ready_to_verify', 'ready_to_export', 'verified']);

export const resolvePortfolioView = (value: string | null | undefined): PortfolioView | null =>
    value && portfolioViews.has(value as PortfolioView) ? (value as PortfolioView) : null;

export const resolvePortfolioExportType = (value: string | null | undefined): PortfolioExportType | null =>
    value && exportTypes.has(value as PortfolioExportType) ? (value as PortfolioExportType) : null;

export const resolvePortfolioStatementVariant = (value: string | null | undefined): PortfolioStatementVariant | null =>
    value && statementVariants.has(value as PortfolioStatementVariant) ? (value as PortfolioStatementVariant) : null;

export const resolvePortfolioEvidenceFilter = (value: string | null | undefined): PortfolioEvidenceFilter | null =>
    value && evidenceFilters.has(value as PortfolioEvidenceFilter) ? (value as PortfolioEvidenceFilter) : null;

const parseRecentViews = (value: unknown): PortfolioView[] => {
    if (!Array.isArray(value)) return [];

    return value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => resolvePortfolioView(item))
        .filter((item): item is PortfolioView => item !== null)
        .slice(0, 4);
};

export const readPortfolioSession = (): PortfolioSessionState | null => {
    if (typeof window === 'undefined') return null;

    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;

        const parsed = JSON.parse(raw) as Partial<PortfolioSessionState>;
        const view = resolvePortfolioView(parsed.view);
        const selectedExportType = resolvePortfolioExportType(parsed.selectedExportType);
        const statementVariant = resolvePortfolioStatementVariant(parsed.statementVariant);
        const evidenceFilter = resolvePortfolioEvidenceFilter(parsed.evidenceFilter);

        if (!view || !selectedExportType || !statementVariant || !evidenceFilter) {
            return null;
        }

        return {
            view,
            selectedExportType,
            statementVariant,
            evidenceFilter,
            lastOpenedStoryId: typeof parsed.lastOpenedStoryId === 'string' ? parsed.lastOpenedStoryId : null,
            recentViews: parseRecentViews(parsed.recentViews),
            updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
        };
    } catch {
        return null;
    }
};

export const writePortfolioSession = (state: PortfolioSessionState) => {
    if (typeof window === 'undefined') return;

    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
        // Ignore storage write failures so the workspace still functions.
    }
};

export const buildRecentViews = (activeView: PortfolioView, currentViews: PortfolioView[]): PortfolioView[] =>
    [activeView, ...currentViews.filter((view) => view !== activeView)].slice(0, 4);
