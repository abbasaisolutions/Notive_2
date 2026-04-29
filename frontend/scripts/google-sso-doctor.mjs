import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const projectRoot = path.resolve(import.meta.dirname, '..');
const backendRoot = path.resolve(projectRoot, '..', 'backend');

const PLACEHOLDER_VALUES = new Set([
    'your-google-client-id',
    'your_google_client_id_here.apps.googleusercontent.com',
    'your-google-client-id-here',
    'your-google-client-id-here.apps.googleusercontent.com',
    'your-actual-client-id',
    'your_google_web_client_id_here.apps.googleusercontent.com',
]);
const EXPECTED_WEB_ORIGINS = [
    'http://localhost',
    'http://localhost:3000',
    'https://notive.abbasaisolutions.com',
];

const parseEnv = (filePath) => {
    const env = {};
    if (!fs.existsSync(filePath)) return env;

    for (const rawLine of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;

        const separatorIndex = line.indexOf('=');
        if (separatorIndex === -1) continue;

        const key = line.slice(0, separatorIndex).trim();
        const value = line.slice(separatorIndex + 1).trim().replace(/^"|"$/g, '');
        env[key] = value;
    }

    return env;
};

const frontendEnv = {
    ...parseEnv(path.join(projectRoot, '.env')),
    ...process.env,
};
const backendEnv = {
    ...parseEnv(path.join(backendRoot, '.env')),
    ...process.env,
};

const isGoogleClientId = (value) => /\.apps\.googleusercontent\.com$/i.test(value || '');
const isMissing = (value) => !value || PLACEHOLDER_VALUES.has(`${value}`.trim().toLowerCase());
const maskClientId = (value) => {
    if (!value) return 'missing';
    if (value.length <= 28) return 'set-but-short';
    return `${value.slice(0, 12)}...${value.slice(-18)}`;
};

const getFrontendClientId = () => (
    frontendEnv.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID
    || frontendEnv.NEXT_PUBLIC_GOOGLE_CLIENT_ID
    || ''
).trim();

const getBackendClientIds = () => Array.from(
    new Set(
        [
            backendEnv.GOOGLE_CLIENT_IDS || '',
            backendEnv.GOOGLE_CLIENT_ID || '',
            backendEnv.GOOGLE_WEB_CLIENT_ID || '',
            backendEnv.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID || '',
            backendEnv.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '',
        ]
            .flatMap((value) => `${value || ''}`.split(','))
            .map((value) => value.trim())
            .filter((value) => !isMissing(value) && isGoogleClientId(value))
    )
);

const classifyGoogleContent = (content) => {
    if (/deleted_client|OAuth client was deleted/i.test(content)) return 'deleted_client';
    if (/invalid_client|OAuth client was not found/i.test(content)) return 'invalid_client';
    if (/redirect_uri_mismatch/i.test(content)) return 'redirect_uri_mismatch';
    if (/accounts\.google\.com|ServiceLogin|signin/i.test(content)) return 'appears_active';
    return 'unknown';
};

const probeGoogleClient = async (clientId) => {
    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: 'https://notive.abbasaisolutions.com',
        response_type: 'id_token',
        scope: 'openid email profile',
        nonce: 'notive-sso-doctor',
        prompt: 'select_account',
    });

    const response = await fetch(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`, {
        redirect: 'follow',
    });
    const content = await response.text();
    return {
        status: response.status,
        result: classifyGoogleContent(content),
    };
};

const blockers = [];
const warnings = [];
const ready = [];

const frontendClientId = getFrontendClientId();
const backendClientIds = getBackendClientIds();

console.log('Google SSO doctor');

if (isMissing(frontendClientId) || !isGoogleClientId(frontendClientId)) {
    blockers.push('Frontend Google OAuth client ID is missing or malformed.');
} else {
    ready.push(`Frontend client: ${maskClientId(frontendClientId)}`);
}

if (backendClientIds.length === 0) {
    blockers.push('Backend Google SSO audience is missing. Set backend GOOGLE_CLIENT_ID or GOOGLE_CLIENT_IDS.');
} else if (!backendClientIds.includes(frontendClientId)) {
    blockers.push('Backend Google SSO audience does not include the frontend client ID.');
    ready.push(`Backend audience count: ${backendClientIds.length}`);
} else {
    ready.push('Backend audience: matches frontend client');
}

if (!blockers.some((item) => item.startsWith('Frontend'))) {
    try {
        const probe = await probeGoogleClient(frontendClientId);
        if (probe.result === 'deleted_client') {
            blockers.push('Google reports this frontend OAuth client was deleted.');
        } else if (probe.result === 'invalid_client') {
            blockers.push('Google reports this frontend OAuth client is invalid or not found.');
        } else if (probe.result === 'redirect_uri_mismatch') {
            warnings.push(`Google client exists, but the live probe saw redirect_uri_mismatch. For Notive's Google Identity web flow, this usually means the OAuth client still needs the right Authorized JavaScript origins: ${EXPECTED_WEB_ORIGINS.join(', ')}.`);
        } else if (probe.result === 'appears_active') {
            ready.push('Google live probe: client appears active');
        } else {
            warnings.push(`Google live probe returned an unclassified response with HTTP ${probe.status}.`);
        }
    } catch (error) {
        warnings.push(`Google live probe could not run: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
}

if (ready.length > 0) {
    console.log('\nReady');
    ready.forEach((line) => console.log(`- ${line}`));
}

if (warnings.length > 0) {
    console.log('\nWarnings');
    warnings.forEach((line) => console.log(`- ${line}`));
}

if (blockers.length > 0) {
    console.log('\nBlockers');
    blockers.forEach((line) => console.log(`- ${line}`));
}

process.exitCode = blockers.length > 0 ? 1 : 0;
