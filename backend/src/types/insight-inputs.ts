/**
 * Shared input shapes for the deterministic insight services
 * (dashboard-insights + journal-intelligence). A single fetcher populates
 * these types so both services can consume the same rows without duplicate
 * Prisma queries or mapping boilerplate.
 */

export type InsightInputEntry = {
    id: string;
    content: string;
    mood: string | null;
    tags: string[];
    createdAt: Date;
    // Extended fields — populated when available; consumers should
    // treat them as optional so callers can omit them selectively.
    title?: string | null;
    skills?: string[];
    lessons?: string[];
    reflection?: string | null;
    lifeArea?: string | null;
};

export type InsightInputAnalysis = {
    entryId: string;
    sentimentScore: number | null;
    emotions: Record<string, number> | null;
    entities: string[] | null;
    topics: string[];
    keywords: string[];
    suggestedMood: string | null;
    wordCount: number | null;
    // Extended — dashboard-insights reads this, journal-intelligence doesn't.
    sentimentLabel?: string | null;
};
