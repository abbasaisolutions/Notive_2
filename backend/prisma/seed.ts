import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    const email = 'admin@notive.com';
    const password = 'Admin123';
    const hashedPassword = await bcrypt.hash(password, 10);

    // Check if admin already exists
    const existing = await prisma.user.findUnique({
        where: { email },
    });

    if (existing) {
        // Update to SUPERADMIN and reset password
        await prisma.user.update({
            where: { email },
            data: { role: 'SUPERADMIN', password: hashedPassword },
        });
        console.log('✅ Admin user updated to SUPERADMIN (password reset)');
    } else {
        // Create new admin
        await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name: 'Admin',
                role: 'SUPERADMIN',
            },
        });
        console.log('✅ Admin user created successfully');
    }

    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
    console.log(`   Role: SUPERADMIN`);
}

main()
    .catch((e) => {
        console.error('Error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
