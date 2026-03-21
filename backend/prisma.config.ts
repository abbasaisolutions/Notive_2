import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

const fallbackDatabaseUrl = 'postgresql://user:password@localhost:5432/notive_db?schema=public';

export default defineConfig({
    schema: 'prisma/schema.prisma',
    migrations: {
        path: 'prisma/migrations',
        seed: 'ts-node prisma/seed.ts',
    },
    datasource: {
        url: process.env.DATABASE_URL || fallbackDatabaseUrl,
    },
});
