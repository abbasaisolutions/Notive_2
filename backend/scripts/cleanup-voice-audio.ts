/**
 * Voice Audio Cleanup Script
 *
 * Clears `audioBufferBase64` from completed/canceled VoiceTranscriptionJob
 * payloads. Run once to reclaim storage from legacy records.
 *
 * Usage:  npx ts-node scripts/cleanup-voice-audio.ts
 */

import 'dotenv/config';
import prisma from '../src/config/prisma';

async function main() {
    const jobs = await prisma.voiceTranscriptionJob.findMany({
        where: {
            status: { in: ['COMPLETED', 'CANCELED'] },
        },
        select: { id: true, payload: true },
    });

    let cleaned = 0;

    for (const job of jobs) {
        const payload = job.payload as Record<string, unknown> | null;
        if (!payload || !('audioBufferBase64' in payload)) continue;

        const { audioBufferBase64: _, ...rest } = payload;
        await prisma.voiceTranscriptionJob.update({
            where: { id: job.id },
            data: { payload: rest },
        });
        cleaned++;
    }

    console.log(`Cleaned ${cleaned} of ${jobs.length} completed/canceled jobs`);
}

main()
    .catch((err) => {
        console.error('Cleanup failed:', err);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
