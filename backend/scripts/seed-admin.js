'use strict';

const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { PrismaClient } = require('@prisma/client');

const PASSWORD_POLICY_MESSAGE = 'Password must be at least 8 characters and include uppercase, lowercase, and a number';
const hasStrongPassword = (value) => /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(value);

const normalizedEmail = (process.env.SUPERADMIN_EMAIL || '').trim().toLowerCase();
const password = (process.env.SUPERADMIN_PASSWORD || '').trim();
const providedName = (process.env.SUPERADMIN_NAME || '').trim();

if (!normalizedEmail) {
    console.log('seed:admin skipped: SUPERADMIN_EMAIL is not set.');
    process.exit(0);
}

if (password && !hasStrongPassword(password)) {
    console.error(`seed:admin failed: ${PASSWORD_POLICY_MESSAGE}`);
    process.exit(1);
}

const ensureDatabaseUrl = () => {
    if (process.env.DATABASE_URL) return;

    const candidates = [
        path.resolve(process.cwd(), '.env'),
        path.resolve(process.cwd(), 'backend/.env'),
        path.resolve(__dirname, '../.env'),
    ];

    for (const envPath of candidates) {
        if (!fs.existsSync(envPath)) continue;
        dotenv.config({ path: envPath, override: false });
        if (process.env.DATABASE_URL) return;
    }
};

const createPrismaClient = () => {
    ensureDatabaseUrl();
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        throw new Error('DATABASE_URL is required to initialize Prisma.');
    }

    let PrismaPg;
    try {
        ({ PrismaPg } = require('@prisma/adapter-pg'));
    } catch (_error) {
        throw new Error('Missing dependency @prisma/adapter-pg for Prisma 7.');
    }

    const adapter = new PrismaPg({ connectionString });
    return new PrismaClient({ adapter });
};

const prisma = createPrismaClient();

async function run() {
    const existingUser = await prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: {
            id: true,
            email: true,
            name: true,
            role: true,
        },
    });

    if (!existingUser && !password) {
        console.error('seed:admin failed: SUPERADMIN_PASSWORD is required to create a new superadmin.');
        process.exitCode = 1;
        return;
    }

    if (existingUser) {
        const updateData = {
            role: 'SUPERADMIN',
        };

        if (providedName) {
            updateData.name = providedName;
        }

        if (password) {
            updateData.password = await bcrypt.hash(password, 12);
        }

        const updatedUser = await prisma.user.update({
            where: { id: existingUser.id },
            data: updateData,
            select: {
                email: true,
                role: true,
            },
        });

        console.log(`seed:admin updated ${updatedUser.email} to ${updatedUser.role}.`);
        return;
    }

    const createdUser = await prisma.user.create({
        data: {
            email: normalizedEmail,
            password: await bcrypt.hash(password, 12),
            name: providedName || 'Admin',
            role: 'SUPERADMIN',
        },
        select: {
            email: true,
            role: true,
        },
    });

    console.log(`seed:admin created ${createdUser.email} as ${createdUser.role}.`);
}

run()
    .catch((error) => {
        console.error('seed:admin failed:', error instanceof Error ? error.message : error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
