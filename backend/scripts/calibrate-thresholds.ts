/**
 * Threshold Calibration Tool
 *
 * Samples real entry pairs from the DB at different cosine-distance brackets,
 * walks you through them interactively, then outputs threshold recommendations
 * for DENSE_MIN_SCORE, RELATED_MIN_SCORE, duplicate detection, and clustering.
 *
 * Usage:
 *   npx ts-node scripts/calibrate-thresholds.ts
 *   npx ts-node scripts/calibrate-thresholds.ts --user <userId>
 *   npx ts-node scripts/calibrate-thresholds.ts --resume   # continue saved session
 *   npx ts-node scripts/calibrate-thresholds.ts --report   # skip labeling, just report
 *
 * Keys during labeling:
 *   r = Related   (similar theme, emotion, or context)
 *   u = Unrelated (different topic / emotion entirely)
 *   d = Duplicate (near-identical content, same event)
 *   s = Skip      (can't judge — too short, too vague)
 *   q = Quit      (saves progress, can resume later)
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';

import prisma from '../src/config/prisma';

// ── Types ─────────────────────────────────────────────────────────────────────

type Label = 'related' | 'unrelated' | 'duplicate' | 'skip';

type LabeledPair = {
    pairId: string;
    entryIdA: string;
    entryIdB: string;
    distance: number; // cosine distance (0 = identical, 2 = opposite)
    similarity: number; // 1 - distance
    label: Label;
};

type SessionData = {
    userId: string;
    model: string;
    dimensions: number;
    generatedAt: string;
    pairs: LabeledPair[];
    pending: Array<{ pairId: string; entryIdA: string; entryIdB: string; distance: number }>;
};

type EntryRow = { id: string; title: string | null; content: string; mood: string | null; createdAt: Date };

// ── Config ────────────────────────────────────────────────────────────────────

const SESSION_PATH = path.resolve(process.cwd(), '.threshold-calibration-session.json');
const REPORT_PATH = path.resolve(process.cwd(), 'threshold-calibration-report.json');

// Distance brackets to sample from.  Each gets PAIRS_PER_BRACKET samples.
// Distance = 1 - cosine_similarity, so 0.0 = identical, 1.0 = orthogonal.
const BRACKETS: Array<{ minDist: number; maxDist: number; label: string }> = [
    { minDist: 0.00, maxDist: 0.10, label: 'near-duplicate zone (sim 0.90-1.00)' },
    { minDist: 0.10, maxDist: 0.25, label: 'highly related (sim 0.75-0.90)' },
    { minDist: 0.25, maxDist: 0.40, label: 'moderately related (sim 0.60-0.75)' },
    { minDist: 0.40, maxDist: 0.55, label: 'loosely related (sim 0.45-0.60)' },
    { minDist: 0.55, maxDist: 0.70, label: 'borderline (sim 0.30-0.45)' },
    { minDist: 0.70, maxDist: 0.90, label: 'unrelated (sim 0.10-0.30)' },
];

const PAIRS_PER_BRACKET = 8; // 6 brackets × 8 pairs = 48 total — ~10-15 min

// ── Helpers ───────────────────────────────────────────────────────────────────

const getArg = (flag: string): string | null => {
    const i = process.argv.indexOf(flag);
    if (i === -1) return null;
    const v = process.argv[i + 1];
    return v && !v.startsWith('--') ? v : null;
};

const hasFlag = (flag: string) => process.argv.includes(flag);

const clip = (text: string, len: number) =>
    text.length <= len ? text : text.slice(0, len - 3) + '...';

const hr = (char = '─', len = 70) => char.repeat(len);

const formatEntry = (entry: EntryRow, label: 'A' | 'B'): string => {
    const date = entry.createdAt.toISOString().slice(0, 10);
    const mood = entry.mood ? ` · mood: ${entry.mood}` : '';
    const preview = clip(entry.content.replace(/\s+/g, ' '), 400);
    return [
        `  [${label}] "${entry.title || '(no title)'}"  ${date}${mood}`,
        `       ${preview}`,
    ].join('\n');
};

async function readKey(): Promise<string> {
    return new Promise((resolve) => {
        const rl = readline.createInterface({ input: process.stdin });
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.once('data', (buf) => {
            const key = buf.toString().toLowerCase();
            process.stdin.setRawMode(false);
            rl.close();
            resolve(key);
        });
    });
}

// ── DB ────────────────────────────────────────────────────────────────────────

async function pickDefaultUserId(): Promise<string> {
    const grouped = await prisma.entry.groupBy({
        by: ['userId'],
        _count: { _all: true },
        where: { deletedAt: null },
        orderBy: { _count: { userId: 'desc' } },
    });
    const id = grouped[0]?.userId;
    if (!id) throw new Error('No entries found in the database.');
    return id;
}

type EmbeddingConfigRow = { model: string; dimensions: number; cnt: bigint };

async function getActiveEmbeddingConfig(userId: string): Promise<{ model: string; dimensions: number } | null> {
    const rows = await prisma.$queryRawUnsafe<EmbeddingConfigRow[]>(
        `SELECT model, dimensions, COUNT(*) AS cnt
         FROM "EntryEmbedding"
         WHERE "userId" = $1
         GROUP BY model, dimensions
         ORDER BY cnt DESC
         LIMIT 1`,
        userId
    );
    if (!rows[0]) return null;
    return { model: rows[0].model, dimensions: Number(rows[0].dimensions) };
}

type PairRow = { entryIdA: string; entryIdB: string; distance: number };

async function samplePairsForBracket(
    userId: string,
    model: string,
    dimensions: number,
    minDist: number,
    maxDist: number,
    limit: number
): Promise<PairRow[]> {
    return prisma.$queryRawUnsafe<PairRow[]>(
        `
        SELECT
            a."entryId" AS "entryIdA",
            b."entryId" AS "entryIdB",
            ((a.embedding::vector(${dimensions})) <=> (b.embedding::vector(${dimensions})))::float8 AS distance
        FROM "EntryEmbedding" a
        JOIN "EntryEmbedding" b
            ON a."entryId" < b."entryId"
            AND b."userId" = $1
            AND b.model = $2
            AND b.dimensions = $3
        JOIN "Entry" ea ON ea.id = a."entryId" AND ea."deletedAt" IS NULL
        JOIN "Entry" eb ON eb.id = b."entryId" AND eb."deletedAt" IS NULL
        WHERE a."userId" = $1
          AND a.model = $2
          AND a.dimensions = $3
          AND ((a.embedding::vector(${dimensions})) <=> (b.embedding::vector(${dimensions}))) >= $4
          AND ((a.embedding::vector(${dimensions})) <=> (b.embedding::vector(${dimensions}))) < $5
        ORDER BY random()
        LIMIT $6
        `,
        userId, model, dimensions, minDist, maxDist, limit
    );
}

async function fetchEntries(ids: string[]): Promise<Map<string, EntryRow>> {
    const rows = await prisma.entry.findMany({
        where: { id: { in: ids }, deletedAt: null },
        select: { id: true, title: true, content: true, mood: true, createdAt: true },
    });
    return new Map(rows.map((r) => [r.id, r]));
}

// ── Session ───────────────────────────────────────────────────────────────────

function loadSession(): SessionData | null {
    if (!fs.existsSync(SESSION_PATH)) return null;
    try {
        return JSON.parse(fs.readFileSync(SESSION_PATH, 'utf8')) as SessionData;
    } catch {
        return null;
    }
}

function saveSession(session: SessionData) {
    fs.writeFileSync(SESSION_PATH, JSON.stringify(session, null, 2), 'utf8');
}

// ── Analysis ──────────────────────────────────────────────────────────────────

type ThresholdRecommendation = {
    name: string;
    current: number;
    recommended: number;
    confidence: 'high' | 'medium' | 'low';
    rationale: string;
};

function analyzeLabels(pairs: LabeledPair[]): ThresholdRecommendation[] {
    const judged = pairs.filter((p) => p.label !== 'skip');
    if (judged.length < 10) {
        console.log('Not enough labeled pairs for confident recommendations (need ≥ 10 judged).');
        return [];
    }

    // For each similarity bucket, compute label distribution
    const byLabel = (label: Label) => judged.filter((p) => p.label === label);
    const related = byLabel('related');
    const unrelated = byLabel('unrelated');
    const duplicates = byLabel('duplicate');

    // Find the similarity boundary between related and unrelated
    const relatedSims = [...related, ...duplicates].map((p) => p.similarity).sort((a, b) => a - b);
    const unrelatedSims = unrelated.map((p) => p.similarity).sort((a, b) => a - b);

    const p10 = (arr: number[]) => arr[Math.floor(arr.length * 0.10)] ?? null;
    const p90 = (arr: number[]) => arr[Math.floor(arr.length * 0.90)] ?? null;
    const median = (arr: number[]) => arr[Math.floor(arr.length * 0.50)] ?? null;

    const recommendations: ThresholdRecommendation[] = [];

    // DENSE_MIN_SCORE — lowest similarity we should ever surface
    const lowestRelated = relatedSims[0] ?? 0.18;
    const recommendedDenseMin = Math.max(0.10, +(lowestRelated - 0.04).toFixed(2));
    recommendations.push({
        name: 'DENSE_MIN_SCORE (env: SEMANTIC_SEARCH_MIN_SCORE)',
        current: 0.16,
        recommended: recommendedDenseMin,
        confidence: relatedSims.length >= 5 ? 'high' : 'low',
        rationale: `Lowest related pair similarity: ${lowestRelated.toFixed(3)}. Set 0.04 below that as safety margin.`,
    });

    // RELATED_MIN_SCORE — for "related entries" feature
    const p10Related = p10(relatedSims);
    const recommendedRelatedMin = p10Related !== null
        ? Math.max(0.15, +(p10Related - 0.02).toFixed(2))
        : 0.18;
    recommendations.push({
        name: 'RELATED_MIN_SCORE (env: RELATED_ENTRIES_MIN_SCORE)',
        current: 0.18,
        recommended: recommendedRelatedMin,
        confidence: relatedSims.length >= 5 ? 'high' : 'medium',
        rationale: `p10 of related similarities: ${(p10Related ?? 0).toFixed(3)}.`,
    });

    // Duplicate detection threshold
    if (duplicates.length >= 2) {
        const dupSims = duplicates.map((p) => p.similarity).sort((a, b) => a - b);
        const recommendedDupThreshold = +(( dupSims[0] ?? 0.7) - 0.03).toFixed(2);
        recommendations.push({
            name: 'Duplicate detection threshold (retrieval-insights.service.ts)',
            current: 0.62,
            recommended: Math.max(0.55, recommendedDupThreshold),
            confidence: duplicates.length >= 4 ? 'high' : 'low',
            rationale: `Lowest duplicate similarity: ${(dupSims[0] ?? 0).toFixed(3)}. Labeled ${duplicates.length} duplicates.`,
        });
    }

    // Rerank skip confidence — only skip reranking when bi-encoder is highly confident
    const highSimRelated = related.filter((p) => p.similarity >= 0.85);
    if (highSimRelated.length >= 2 || unrelated.filter((p) => p.similarity >= 0.80).length > 0) {
        const falseHighConf = unrelated.filter((p) => p.similarity >= 0.80).length;
        const trueHighConf = related.filter((p) => p.similarity >= 0.85).length;
        const recommendedSkip = falseHighConf > 0 ? 0.92 : 0.88;
        const confidence: 'high' | 'medium' | 'low' = falseHighConf + trueHighConf >= 3 ? 'medium' : 'low';
        recommendations.push({
            name: 'SEMANTIC_RERANK_SKIP_CONFIDENCE',
            current: 0.88,
            recommended: recommendedSkip,
            confidence,
            rationale: `${falseHighConf} unrelated pairs ≥ 0.80 similarity (bi-encoder false positives). ${trueHighConf} true high-conf matches ≥ 0.85.`,
        });
    }

    // Theme clustering threshold
    const medianRelated = median(relatedSims);
    const p90Unrelated = p90(unrelatedSims);
    if (medianRelated !== null && p90Unrelated !== null) {
        const boundary = (medianRelated + p90Unrelated) / 2;
        recommendations.push({
            name: 'Theme clustering threshold (retrieval-insights.service.ts)',
            current: 0.42,
            recommended: +(boundary.toFixed(2)),
            confidence: judged.length >= 30 ? 'medium' : 'low',
            rationale: `Midpoint between median related (${medianRelated.toFixed(3)}) and p90 unrelated (${p90Unrelated.toFixed(3)}).`,
        });
    }

    return recommendations;
}

function printReport(session: SessionData) {
    const labeled = session.pairs.filter((p) => p.label !== 'skip');
    const byLabel = (l: Label) => session.pairs.filter((p) => p.label === l);

    console.log('');
    console.log(hr('═'));
    console.log('  THRESHOLD CALIBRATION REPORT');
    console.log(hr('═'));
    console.log(`  User:       ${session.userId}`);
    console.log(`  Model:      ${session.model} (${session.dimensions}d)`);
    console.log(`  Generated:  ${session.generatedAt}`);
    console.log(`  Total pairs reviewed: ${session.pairs.length}`);
    console.log(`  Judged (excl. skip):  ${labeled.length}`);
    console.log('');
    console.log('  Label breakdown:');
    console.log(`    related:    ${byLabel('related').length}`);
    console.log(`    unrelated:  ${byLabel('unrelated').length}`);
    console.log(`    duplicate:  ${byLabel('duplicate').length}`);
    console.log(`    skip:       ${byLabel('skip').length}`);
    console.log('');

    // Similarity distribution per label
    for (const label of ['related', 'unrelated', 'duplicate'] as Label[]) {
        const sims = byLabel(label).map((p) => p.similarity).sort((a, b) => a - b);
        if (sims.length === 0) continue;
        const min = sims[0].toFixed(3);
        const max = sims[sims.length - 1].toFixed(3);
        const avg = (sims.reduce((s, v) => s + v, 0) / sims.length).toFixed(3);
        console.log(`  ${label.padEnd(10)} similarity — min: ${min}  avg: ${avg}  max: ${max}`);
    }

    console.log('');
    console.log(hr());
    console.log('  RECOMMENDATIONS');
    console.log(hr());

    const recs = analyzeLabels(session.pairs);
    if (recs.length === 0) return;

    for (const rec of recs) {
        const changed = rec.recommended !== rec.current;
        const arrow = changed
            ? `${rec.current} → ${rec.recommended}  [${rec.confidence} confidence]`
            : `${rec.current} (no change)`;
        console.log('');
        console.log(`  ${rec.name}`);
        console.log(`    ${arrow}`);
        console.log(`    ${rec.rationale}`);
    }

    console.log('');
    console.log(hr());
    console.log('  ENV DIFF (copy changed values into your .env)');
    console.log(hr());

    for (const rec of recs) {
        if (rec.recommended === rec.current) continue;
        const envKey = rec.name.match(/\(env: ([^)]+)\)/)?.[1];
        if (envKey) {
            console.log(`  ${envKey}="${rec.recommended}"`);
        }
    }

    console.log('');

    // Save report JSON
    fs.writeFileSync(REPORT_PATH, JSON.stringify({ session, recommendations: recs }, null, 2), 'utf8');
    console.log(`  Full report saved: ${REPORT_PATH}`);
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
    const resumeMode = hasFlag('--resume');
    const reportMode = hasFlag('--report');

    // Report-only mode
    if (reportMode) {
        const session = loadSession();
        if (!session) {
            console.error('No saved session found. Run without --report first.');
            process.exitCode = 1;
            return;
        }
        printReport(session);
        return;
    }

    // Load or initialize session
    let session: SessionData;

    if (resumeMode) {
        const saved = loadSession();
        if (!saved) {
            console.error('No saved session found. Run without --resume to start a new session.');
            process.exitCode = 1;
            return;
        }
        session = saved;
        console.log(`Resuming session — ${session.pending.length} pairs remaining.`);
    } else {
        const userId = getArg('--user') || await pickDefaultUserId();
        const config = await getActiveEmbeddingConfig(userId);

        if (!config) {
            console.error(`No embeddings found for user ${userId}. Run backfill-embeddings.ts first.`);
            process.exitCode = 1;
            return;
        }

        console.log('');
        console.log(hr('═'));
        console.log('  NOTIVE THRESHOLD CALIBRATION');
        console.log(hr('═'));
        console.log(`  User:    ${userId}`);
        console.log(`  Model:   ${config.model} (${config.dimensions}d)`);
        console.log('');
        console.log('  Sampling pairs from each similarity bracket...');

        const pending: SessionData['pending'] = [];

        for (const bracket of BRACKETS) {
            const rows = await samplePairsForBracket(
                userId, config.model, config.dimensions,
                bracket.minDist, bracket.maxDist, PAIRS_PER_BRACKET
            );
            for (const row of rows) {
                pending.push({
                    pairId: `${row.entryIdA}--${row.entryIdB}`,
                    entryIdA: row.entryIdA,
                    entryIdB: row.entryIdB,
                    distance: row.distance,
                });
            }
            console.log(`    ${bracket.label}: ${rows.length} pairs sampled`);
        }

        if (pending.length === 0) {
            console.error('\n  Not enough entries with embeddings to sample pairs.');
            console.error('  You need at least ~20 embedded entries. Run backfill-embeddings.ts first.\n');
            process.exitCode = 1;
            return;
        }

        // Shuffle so brackets are interleaved
        for (let i = pending.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [pending[i], pending[j]] = [pending[j], pending[i]];
        }

        session = {
            userId,
            model: config.model,
            dimensions: config.dimensions,
            generatedAt: new Date().toISOString(),
            pairs: [],
            pending,
        };

        saveSession(session);

        console.log('');
        console.log(`  Total pairs to label: ${pending.length}`);
        console.log(`  Estimated time: ${Math.ceil(pending.length * 0.3)} minutes`);
    }

    console.log('');
    console.log(hr());
    console.log('  HOW TO ANSWER');
    console.log(hr());
    console.log('  r = Related    (similar theme, emotion, or context)');
    console.log('  u = Unrelated  (different topic / emotion entirely)');
    console.log('  d = Duplicate  (near-identical content, same event)');
    console.log('  s = Skip       (can\'t judge — too short, too vague)');
    console.log('  q = Quit       (saves progress — resume with --resume)');
    console.log(hr());
    console.log('  Press any key to start...');

    await readKey();

    let index = 0;
    while (session.pending.length > 0) {
        const item = session.pending[0];
        index++;

        const entryMap = await fetchEntries([item.entryIdA, item.entryIdB]);
        const entryA = entryMap.get(item.entryIdA);
        const entryB = entryMap.get(item.entryIdB);

        const total = session.pairs.length + session.pending.length;
        const done = session.pairs.length;
        const sim = (1 - item.distance).toFixed(3);
        const dist = item.distance.toFixed(3);

        console.log('');
        console.log(hr());
        console.log(`  Pair ${done + 1} / ${total}   similarity: ${sim}   distance: ${dist}`);
        console.log(hr());

        if (entryA) console.log(formatEntry(entryA, 'A'));
        else console.log('  [A] (entry not found)');

        console.log('');

        if (entryB) console.log(formatEntry(entryB, 'B'));
        else console.log('  [B] (entry not found)');

        console.log('');
        process.stdout.write('  Label (r/u/d/s/q): ');

        const key = await readKey();
        console.log(key);

        if (key === 'q') {
            console.log('\n  Progress saved. Run with --resume to continue.\n');
            saveSession(session);
            return;
        }

        const labelMap: Record<string, Label> = { r: 'related', u: 'unrelated', d: 'duplicate', s: 'skip' };
        const label = labelMap[key];

        if (!label) {
            // Invalid key — don't advance, let user try again
            console.log('  (invalid key — press r, u, d, s, or q)');
            continue;
        }

        // Record the label
        session.pairs.push({
            pairId: item.pairId,
            entryIdA: item.entryIdA,
            entryIdB: item.entryIdB,
            distance: item.distance,
            similarity: 1 - item.distance,
            label,
        });

        session.pending.shift();
        saveSession(session);
    }

    console.log('');
    console.log(hr('═'));
    console.log('  LABELING COMPLETE');
    console.log(hr('═'));

    printReport(session);

    // Clean up session file
    if (fs.existsSync(SESSION_PATH)) fs.unlinkSync(SESSION_PATH);
}

main()
    .catch((err) => {
        console.error(err);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
