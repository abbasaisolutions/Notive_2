// Super Admin Seed Script
// Creates (or updates) the super admin user for the Notive application.
// Run with: npm run seed:admin

import bcrypt from 'bcryptjs';
import prisma from '../src/config/prisma';

const ADMIN_EMAIL = 'admin@notive.com';
const ADMIN_PASSWORD = 'Admin123@';
const ADMIN_NAME = 'Super Admin';
const SALT_ROUNDS = 12; // Matches the bcrypt cost factor used in auth.controller.ts

async function main() {
    console.log('🔐 Starting super admin seed...\n');

    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, SALT_ROUNDS);

    const existing = await prisma.user.findUnique({
        where: { email: ADMIN_EMAIL },
    });

    if (existing) {
        // User already exists — promote to SUPERADMIN and reset password/name
        await prisma.user.update({
            where: { email: ADMIN_EMAIL },
            data: {
                name: ADMIN_NAME,
                password: hashedPassword,
                role: 'SUPERADMIN',
            },
        });
        console.log('✅ Existing user updated to SUPERADMIN with new credentials.');
    } else {
        // Create a brand-new super admin user
        await prisma.user.create({
            data: {
                email: ADMIN_EMAIL,
                password: hashedPassword,
                name: ADMIN_NAME,
                role: 'SUPERADMIN',
            },
        });
        console.log('✅ Super admin user created successfully.');
    }

    console.log(`\n   📧 Email   : ${ADMIN_EMAIL}`);
    console.log(`   🔑 Password: ${ADMIN_PASSWORD}`);
    console.log(`   👤 Name    : ${ADMIN_NAME}`);
    console.log(`   🛡️  Role    : SUPERADMIN\n`);
}

main()
    .catch((error) => {
        console.error('❌ Seed failed:', error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
