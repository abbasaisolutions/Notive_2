import prisma from '../config/prisma';
import { getRedisClient } from '../config/redis';
import { aiRuntime, hasEmbeddingProvider, hasLlmProvider } from '../config/ai';
import { collectProductionReadinessChecks } from '../config/production-readiness';

export type RuntimeReadinessStatus = 'ready' | 'degraded' | 'not_configured' | 'error';

export type RuntimeReadinessComponent = {
    key: string;
    required: boolean;
    status: RuntimeReadinessStatus;
    message: string;
    details?: Record<string, unknown>;
};

export type RuntimeReadinessReport = {
    status: 'ok' | 'degraded' | 'error';
    checkedAt: string;
    cacheTtlMs: number;
    components: RuntimeReadinessComponent[];
};

const READINESS_CACHE_TTL_MS = 15_000;

let cachedReport: RuntimeReadinessReport | null = null;
let cachedAt = 0;
let inFlightReport: Promise<RuntimeReadinessReport> | null = null;

const createComponent = (
    key: string,
    required: boolean,
    status: RuntimeReadinessStatus,
    message: string,
    details?: Record<string, unknown>
): RuntimeReadinessComponent => ({
    key,
    required,
    status,
    message,
    ...(details ? { details } : {}),
});

const getErrorMessage = (error: unknown, fallback: string) =>
    error instanceof Error && error.message ? error.message : fallback;

const checkDatabaseReadiness = async (): Promise<RuntimeReadinessComponent> => {
    try {
        const queryRawUnsafe = (prisma as any).$queryRawUnsafe;
        if (typeof queryRawUnsafe === 'function') {
            await queryRawUnsafe.call(prisma, 'SELECT 1');
        }

        return createComponent(
            'database',
            true,
            'ready',
            'Postgres is reachable through Prisma.'
        );
    } catch (error) {
        return createComponent(
            'database',
            true,
            'error',
            'Database connectivity check failed.',
            { error: getErrorMessage(error, 'Database query failed') }
        );
    }
};

const checkRedisReadiness = async (): Promise<RuntimeReadinessComponent> => {
    try {
        const redis = getRedisClient() as any;
        const clientType = redis?.__notiveClientType === 'fallback' ? 'fallback' : 'redis';

        if (typeof redis?.ping === 'function') {
            await redis.ping();
        } else if (!redis?.isOpen) {
            throw new Error('Redis client is not open');
        }

        if (clientType === 'fallback') {
            return createComponent(
                'redis',
                false,
                'degraded',
                'Redis is running in in-memory fallback mode.',
                { configured: Boolean((process.env.REDIS_URL || '').trim()) }
            );
        }

        return createComponent(
            'redis',
            false,
            'ready',
            'Redis is reachable for caching and rate limiting.'
        );
    } catch (error) {
        return createComponent(
            'redis',
            false,
            'degraded',
            'Redis is unavailable; the app will fall back to reduced caching guarantees.',
            { error: getErrorMessage(error, 'Redis check failed') }
        );
    }
};

const checkAiReadiness = (): RuntimeReadinessComponent[] => {
    const llmStatus: RuntimeReadinessStatus =
        aiRuntime.llmVendor === 'disabled'
            ? 'not_configured'
            : hasLlmProvider()
                ? 'ready'
                : 'degraded';

    const embeddingStatus: RuntimeReadinessStatus =
        aiRuntime.embeddingVendor === 'local_hash'
            ? 'ready'
            : hasEmbeddingProvider()
                ? 'ready'
                : 'degraded';

    return [
        createComponent(
            'llm_provider',
            false,
            llmStatus,
            llmStatus === 'ready'
                ? 'LLM provider is configured.'
                : llmStatus === 'not_configured'
                    ? 'LLM provider is intentionally disabled.'
                    : 'LLM provider is selected but not fully configured.',
            {
                vendor: aiRuntime.llmVendor,
                model: aiRuntime.chatModel,
            }
        ),
        createComponent(
            'embedding_provider',
            false,
            embeddingStatus,
            embeddingStatus === 'ready'
                ? 'Embedding provider is configured.'
                : 'Embedding provider is not fully configured.',
            {
                vendor: aiRuntime.embeddingVendor,
                model: aiRuntime.embeddingModel,
                serviceUrlConfigured: Boolean(aiRuntime.embeddingServiceUrl),
            }
        ),
    ];
};

const checkProductionConfigReadiness = (): RuntimeReadinessComponent[] => {
    const isProduction = process.env.NODE_ENV === 'production';

    return collectProductionReadinessChecks().map((check) => {
        const required = check.severity === 'required';
        const status: RuntimeReadinessStatus = check.ready
            ? 'ready'
            : required && isProduction
                ? 'error'
                : 'degraded';

        return createComponent(
            check.key,
            required,
            status,
            check.message,
            { action: check.action }
        );
    });
};

const computeOverallStatus = (components: RuntimeReadinessComponent[]): RuntimeReadinessReport['status'] => {
    const hasRequiredFailure = components.some((component) => component.required && component.status === 'error');
    if (hasRequiredFailure) {
        return 'error';
    }

    const hasNonReadyComponents = components.some((component) => component.status !== 'ready');
    return hasNonReadyComponents ? 'degraded' : 'ok';
};

const buildRuntimeReadinessReport = async (): Promise<RuntimeReadinessReport> => {
    const components = [
        await checkDatabaseReadiness(),
        await checkRedisReadiness(),
        ...checkAiReadiness(),
        ...checkProductionConfigReadiness(),
    ];

    return {
        status: computeOverallStatus(components),
        checkedAt: new Date().toISOString(),
        cacheTtlMs: READINESS_CACHE_TTL_MS,
        components,
    };
};

export const getRuntimeReadinessReport = async (): Promise<RuntimeReadinessReport> => {
    const now = Date.now();
    if (cachedReport && now - cachedAt < READINESS_CACHE_TTL_MS) {
        return cachedReport;
    }

    if (inFlightReport) {
        return inFlightReport;
    }

    inFlightReport = buildRuntimeReadinessReport();

    try {
        cachedReport = await inFlightReport;
        cachedAt = Date.now();
        return cachedReport;
    } finally {
        inFlightReport = null;
    }
};
