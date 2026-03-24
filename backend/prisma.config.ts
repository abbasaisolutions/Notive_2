import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { defineConfig } from 'prisma/config';

const resolveDatabaseUrl = () => {
    if (process.env.DATABASE_URL) {
        return process.env.DATABASE_URL;
    }

    const candidates = [
        path.resolve(process.cwd(), '.env'),
        path.resolve(process.cwd(), 'backend/.env'),
        path.resolve(__dirname, '.env'),
    ];

    for (const envPath of candidates) {
        if (!fs.existsSync(envPath)) continue;
        dotenv.config({ path: envPath, override: false });
        if (process.env.DATABASE_URL) {
            return process.env.DATABASE_URL;
        }
    }

    throw new Error(
        'DATABASE_URL is required for Prisma CLI. Set it in the environment or in backend/.env.'
    );
};

const databaseUrl = resolveDatabaseUrl();

export default defineConfig({
    schema: 'prisma/schema.prisma',
    migrations: {
        path: 'prisma/migrations',
        seed: 'ts-node prisma/seed.ts',
    },
    datasource: {
        url: databaseUrl,
    },
});
