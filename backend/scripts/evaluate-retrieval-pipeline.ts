import fs from 'fs';
import path from 'path';

import prisma from '../src/config/prisma';
import { executeHybridSearch } from '../src/services/hybrid-search.service';
import semanticSearchService from '../src/services/semantic-search.service';

type RetrievalEvalDataset = {
    meta?: {
        userId?: string;
    };
    entries: Array<{
        id: string;
        title?: string | null;
        text: string;
    }>;
    queries: Array<{
        id: string;
        text: string;
        relevant: string[];
    }>;
};

type EvalSummary = {
    label: string;
    recallAt10: number;
    mrrAt10: number;
    ndcgAt10: number;
    avgLatencyMs: number;
    failures: Array<{
        queryId: string;
        query: string;
        relevant: string[];
        topResults: string[];
    }>;
};

const DEFAULT_DATASET_PATH = path.resolve(
    process.cwd(),
    '../similarity-service/eval/private/notive_retrieval.current.json'
);

const getArgValue = (flag: string): string | null => {
    const index = process.argv.indexOf(flag);
    if (index === -1) return null;
    const value = process.argv[index + 1];
    return value && !value.startsWith('--') ? value : null;
};

const hasFlag = (flag: string): boolean => process.argv.includes(flag);

const round = (value: number, digits = 4) => Number(value.toFixed(digits));

const recallAtK = (rankedIds: string[], relevantIds: string[], k: number): number => {
    if (relevantIds.length === 0) return 0;
    const topIds = new Set(rankedIds.slice(0, k));
    return relevantIds.some((relevantId) => topIds.has(relevantId)) ? 1 : 0;
};

const mrrAtK = (rankedIds: string[], relevantIds: string[], k: number): number => {
    const relevant = new Set(relevantIds);
    for (let index = 0; index < Math.min(rankedIds.length, k); index += 1) {
        if (relevant.has(rankedIds[index])) {
            return 1 / (index + 1);
        }
    }
    return 0;
};

const ndcgAtK = (rankedIds: string[], relevantIds: string[], k: number): number => {
    const relevant = new Set(relevantIds);
    if (relevant.size === 0) return 0;

    let dcg = 0;
    rankedIds.slice(0, k).forEach((entryId, index) => {
        if (relevant.has(entryId)) {
            dcg += 1 / Math.log2(index + 2);
        }
    });

    const idealHits = Math.min(relevant.size, k);
    let idcg = 0;
    for (let index = 0; index < idealHits; index += 1) {
        idcg += 1 / Math.log2(index + 2);
    }

    return idcg > 0 ? dcg / idcg : 0;
};

const summarizeResults = (
    label: string,
    rows: Array<{
        queryId: string;
        query: string;
        relevant: string[];
        ranked: string[];
        latencyMs: number;
    }>
): EvalSummary => {
    const recalls = rows.map((row) => recallAtK(row.ranked, row.relevant, 10));
    const mrrs = rows.map((row) => mrrAtK(row.ranked, row.relevant, 10));
    const ndcgs = rows.map((row) => ndcgAtK(row.ranked, row.relevant, 10));
    const avgLatencyMs = rows.length > 0
        ? rows.reduce((sum, row) => sum + row.latencyMs, 0) / rows.length
        : 0;

    return {
        label,
        recallAt10: round(recalls.reduce((sum, value) => sum + value, 0) / Math.max(1, recalls.length)),
        mrrAt10: round(mrrs.reduce((sum, value) => sum + value, 0) / Math.max(1, mrrs.length)),
        ndcgAt10: round(ndcgs.reduce((sum, value) => sum + value, 0) / Math.max(1, ndcgs.length)),
        avgLatencyMs: round(avgLatencyMs, 2),
        failures: rows
            .filter((row) => recallAtK(row.ranked, row.relevant, 10) === 0)
            .map((row) => ({
                queryId: row.queryId,
                query: row.query,
                relevant: row.relevant,
                topResults: row.ranked.slice(0, 5),
            })),
    };
};

const printSummary = (summary: EvalSummary) => {
    console.log(summary.label);
    console.log(`  recall@10=${summary.recallAt10}`);
    console.log(`  mrr@10=${summary.mrrAt10}`);
    console.log(`  ndcg@10=${summary.ndcgAt10}`);
    console.log(`  avg_latency_ms=${summary.avgLatencyMs}`);

    if (summary.failures.length > 0) {
        console.log('  misses:');
        summary.failures.slice(0, 5).forEach((failure) => {
            console.log(`    - ${failure.queryId}: top_results=${failure.topResults.join(', ') || 'none'}`);
        });
    }
};

async function main() {
    const datasetPath = path.resolve(getArgValue('--dataset') || DEFAULT_DATASET_PATH);
    const outputPath = getArgValue('--output');
    const limit = Number.parseInt(getArgValue('--limit') || '10', 10);
    const payload = JSON.parse(fs.readFileSync(datasetPath, 'utf8')) as RetrievalEvalDataset;

    if (!Array.isArray(payload.entries) || payload.entries.length === 0) {
        throw new Error('Dataset is missing entries.');
    }
    if (!Array.isArray(payload.queries) || payload.queries.length === 0) {
        throw new Error('Dataset is missing queries.');
    }

    const userId = payload.meta?.userId || getArgValue('--user');
    if (!userId) {
        throw new Error('Dataset meta.userId is missing. Rebuild the private eval dataset or pass --user.');
    }

    const existingUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
    });
    if (!existingUser) {
        throw new Error(`User ${userId} was not found in the current database.`);
    }

    const queryLimit = Math.max(1, Math.min(limit, 20));

    const denseRows: Array<{
        queryId: string;
        query: string;
        relevant: string[];
        ranked: string[];
        latencyMs: number;
    }> = [];
    const hybridRows: typeof denseRows = [];

    for (const query of payload.queries) {
        const denseStart = performance.now();
        const denseMatches = await semanticSearchService.findDenseMatches({
            userId,
            query: query.text,
            limit: queryLimit,
        });
        const denseLatencyMs = performance.now() - denseStart;
        denseRows.push({
            queryId: query.id,
            query: query.text,
            relevant: query.relevant,
            ranked: denseMatches.map((match) => match.entryId),
            latencyMs: denseLatencyMs,
        });

        const hybridStart = performance.now();
        const hybridResults = await executeHybridSearch({
            userId,
            query: query.text,
            limit: queryLimit,
        });
        const hybridLatencyMs = performance.now() - hybridStart;
        hybridRows.push({
            queryId: query.id,
            query: query.text,
            relevant: query.relevant,
            ranked: hybridResults.results.map((result) => result.id),
            latencyMs: hybridLatencyMs,
        });
    }

    const summaries = [
        summarizeResults('pipeline::dense', denseRows),
        summarizeResults('pipeline::hybrid', hybridRows),
    ];

    console.log(`Dataset: ${datasetPath}`);
    console.log(`Queries: ${payload.queries.length}`);
    console.log(`Entries: ${payload.entries.length}`);
    console.log(`User: ${userId}`);
    console.log('');

    summaries.forEach((summary) => {
        printSummary(summary);
        console.log('');
    });

    if (outputPath) {
        const resolvedOutputPath = path.resolve(outputPath);
        fs.mkdirSync(path.dirname(resolvedOutputPath), { recursive: true });
        fs.writeFileSync(
            resolvedOutputPath,
            JSON.stringify(
                {
                    dataset: datasetPath,
                    queryCount: payload.queries.length,
                    entryCount: payload.entries.length,
                    userId,
                    summaries,
                },
                null,
                2
            ),
            'utf8'
        );
        console.log(`Saved report: ${resolvedOutputPath}`);
    }

    if (hasFlag('--fail-on-miss') && summaries.some((summary) => summary.failures.length > 0)) {
        process.exitCode = 1;
    }
}

main()
    .catch((error) => {
        console.error('Retrieval pipeline evaluation failed:', error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
