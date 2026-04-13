export type LifeBalanceArea = {
    area: string;
    score: number;
    entryCount: number;
    dominantMood?: string | null;
    recentTrend?: 'up' | 'stable' | 'down';
};

export const LIFE_BALANCE_RING_CIRCUMFERENCE = 94.2;

const clampLifeBalanceScore = (balanceScore: number) => {
    if (!Number.isFinite(balanceScore)) return 0;
    return Math.max(0, Math.min(100, balanceScore));
};

export const normalizeLifeBalanceAreaKey = (value: string | null | undefined) =>
    String(value || '').trim().toLowerCase();

export const getLifeBalanceScoreLabel = (balanceScore: number) =>
    Math.round(clampLifeBalanceScore(balanceScore));

export const getLifeBalanceRingFill = (
    balanceScore: number,
    circumference = LIFE_BALANCE_RING_CIRCUMFERENCE
) => Number((((clampLifeBalanceScore(balanceScore) / 100) * circumference)).toFixed(1));

export const getVisibleLifeBalanceAreas = (areas: LifeBalanceArea[] | null | undefined) =>
    [...(areas ?? [])]
        .filter((area) => area.entryCount > 0 && area.score > 0)
        .sort((left, right) => right.score - left.score);
