import { getRedisClient } from '../config/redis';
import { serverLogger } from '../utils/server-logger';
import type { JournalIntelligence } from './journal-intelligence.service';

const CACHE_TTL_SECONDS = 5 * 60;
const cacheKey = (userId: string, days: number) => `journal-intelligence:${userId}:${days}`;

export const getCachedJournalIntelligence = async (
    userId: string,
    days: number,
): Promise<JournalIntelligence | null> => {
    try {
        const cached = await getRedisClient().get(cacheKey(userId, days));
        return cached ? (JSON.parse(cached) as JournalIntelligence) : null;
    } catch (error) {
        serverLogger.warn('journal_intelligence.cache_read_failed', {
            userId,
            message: error instanceof Error ? error.message : String(error),
        });
        return null;
    }
};

export const setCachedJournalIntelligence = async (
    userId: string,
    days: number,
    intelligence: JournalIntelligence,
): Promise<void> => {
    try {
        await getRedisClient().set(
            cacheKey(userId, days),
            JSON.stringify(intelligence),
            { EX: CACHE_TTL_SECONDS },
        );
    } catch (error) {
        serverLogger.warn('journal_intelligence.cache_write_failed', {
            userId,
            message: error instanceof Error ? error.message : String(error),
        });
    }
};
