import bcrypt from 'bcryptjs';

const PASSWORD_POLICY_MESSAGE = 'Password must be at least 8 characters and include uppercase, lowercase, and a number';
const hasStrongPassword = (value: string): boolean =>
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(value);

const getArgValue = (name: string): string | undefined => {
    const exactPrefix = `--${name}=`;
    const exactMatch = process.argv.find(arg => arg.startsWith(exactPrefix));
    if (exactMatch) {
        return exactMatch.slice(exactPrefix.length).trim();
    }

    const index = process.argv.indexOf(`--${name}`);
    if (index >= 0) {
        return process.argv[index + 1]?.trim();
    }

    return undefined;
};

const hasFlag = (name: string) => process.argv.includes(`--${name}`);

const printUsage = () => {
    console.log('Create or promote a superadmin user.');
    console.log('');
    console.log('Usage:');
    console.log('  npm run user:create-superadmin -- --email you@example.com --password StrongPass123 --name "Your Name"');
    console.log('');
    console.log('Options:');
    console.log('  --email           Required. Email for the superadmin account.');
    console.log('  --password        Required for new users. Optional when promoting an existing user.');
    console.log('  --name            Optional. Defaults to "Admin" for new users.');
    console.log('  --promote-only    Fail instead of creating a new user when the email does not exist.');
    console.log('');
    console.log('Environment variable alternatives:');
    console.log('  SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD, SUPERADMIN_NAME');
};

const run = async () => {
    if (hasFlag('help')) {
        printUsage();
        return;
    }

    const normalizedEmail = (getArgValue('email') || process.env.SUPERADMIN_EMAIL || '')
        .trim()
        .toLowerCase();
    const password = (getArgValue('password') || process.env.SUPERADMIN_PASSWORD || '').trim();
    const providedName = (getArgValue('name') || process.env.SUPERADMIN_NAME || '').trim();
    const promoteOnly = hasFlag('promote-only');

    if (!normalizedEmail) {
        throw new Error('Missing required email. Pass --email or SUPERADMIN_EMAIL.');
    }

    if (password && !hasStrongPassword(password)) {
        throw new Error(PASSWORD_POLICY_MESSAGE);
    }

    const prisma = (await import('../src/config/prisma')).default;
    const existingUser = await prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: {
            id: true,
            email: true,
            name: true,
            role: true,
            password: true,
        },
    });

    if (!existingUser && promoteOnly) {
        throw new Error(`No existing user found for ${normalizedEmail}. Remove --promote-only to create one.`);
    }

    if (!existingUser && !password) {
        throw new Error('A strong password is required when creating a new superadmin.');
    }

    const hashedPassword = password ? await bcrypt.hash(password, 12) : undefined;

    if (existingUser) {
        const updatedUser = await prisma.user.update({
            where: { id: existingUser.id },
            data: {
                role: 'SUPERADMIN',
                ...(providedName ? { name: providedName } : {}),
                ...(hashedPassword ? { password: hashedPassword } : {}),
            },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
            },
        });

        console.log('Superadmin updated successfully.');
        console.log(`  Email: ${updatedUser.email}`);
        console.log(`  Role: ${updatedUser.role}`);
        console.log(`  Password updated: ${hashedPassword ? 'yes' : 'no'}`);
        return;
    }

    const createdUser = await prisma.user.create({
        data: {
            email: normalizedEmail,
            password: hashedPassword!,
            name: providedName || 'Admin',
            role: 'SUPERADMIN',
        },
        select: {
            id: true,
            email: true,
            name: true,
            role: true,
        },
    });

    console.log('Superadmin created successfully.');
    console.log(`  Email: ${createdUser.email}`);
    console.log(`  Role: ${createdUser.role}`);
};

run()
    .catch((error) => {
        console.error('Superadmin setup failed:', error instanceof Error ? error.message : error);
        process.exitCode = 1;
    });
