import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

// Prevent multiple instances of Prisma Client in development
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const ensureDatabaseUrl = () => {
    if (process.env.DATABASE_URL) return;

    const candidates = [
        path.resolve(process.cwd(), '.env'),
        path.resolve(process.cwd(), 'backend/.env'),
        path.resolve(__dirname, '../../.env'),
    ];

    for (const envPath of candidates) {
        if (!fs.existsSync(envPath)) continue;
        dotenv.config({ path: envPath, override: false });
        if (process.env.DATABASE_URL) return;
    }
};

const createPrismaClient = (): PrismaClient => {
    ensureDatabaseUrl();
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        throw new Error('DATABASE_URL is required to initialize Prisma.');
    }

    let PrismaPg: new (options: { connectionString: string }) => unknown;
    try {
        ({ PrismaPg } = require('@prisma/adapter-pg') as {
            PrismaPg: new (options: { connectionString: string }) => unknown;
        });
    } catch (error) {
        throw new Error(
            'Missing dependency @prisma/adapter-pg for Prisma 7. Run: npm i @prisma/adapter-pg'
        );
    }

    const adapter = new PrismaPg({ connectionString });
    return new PrismaClient({ adapter } as any);
};

const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
