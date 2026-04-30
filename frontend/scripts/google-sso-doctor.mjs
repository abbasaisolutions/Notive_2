import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const projectRoot = path.resolve(import.meta.dirname, '..');
const backendRoot = path.resolve(projectRoot, '..', 'backend');

const APP_ID = 'com.notive.app';
const googleServicesPath = path.join(projectRoot, 'android', 'app', 'google-services.json');

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
const normalizeSha1Fingerprint = (value) => `${value || ''}`.replace(/[^0-9a-f]/gi, '').toLowerCase();
const isSha1Fingerprint = (value) => /^[0-9a-f]{40}$/i.test(normalizeSha1Fingerprint(value));
const maskClientId = (value) => {
    if (!value) return 'missing';
    if (value.length <= 28) return 'set-but-short';
    return `${value.slice(0, 12)}...${value.slice(-18)}`;
};
const formatMaskedClientIds = (clientIds) => clientIds.map(maskClientId).join(', ');

const getFrontendClientId = () => (
    frontendEnv.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID
    || frontendEnv.NEXT_PUBLIC_GOOGLE_CLIENT_ID
    || ''
).trim();

const getAndroidNativeServerClientId = () => (
    frontendEnv.NEXT_PUBLIC_GOOGLE_ANDROID_SERVER_CLIENT_ID || ''
).trim();

const getPlayAppSigningSha1 = () => (
    frontendEnv.PLAY_APP_SIGNING_SHA1
    || backendEnv.PLAY_APP_SIGNING_SHA1
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

const getGoogleServicesOauthStatus = () => {
    if (!fs.existsSync(googleServicesPath)) {
        return {
            status: 'missing_file',
            message: '`frontend/android/app/google-services.json` is missing, so Android OAuth setup cannot be audited locally.',
        };
    }

    try {
        const googleServices = JSON.parse(fs.readFileSync(googleServicesPath, 'utf8'));
        const appClients = (googleServices.client || [])
            .filter((client) => client?.client_info?.android_client_info?.package_name === APP_ID);

        if (appClients.length === 0) {
            return {
                status: 'missing_package',
                message: `\`google-services.json\` does not include Android package \`${APP_ID}\`.`,
            };
        }

        const androidOauthClients = appClients
            .flatMap((client) => client?.oauth_client || [])
            .filter((client) => Number(client?.client_type) === 1 && client?.android_info?.package_name === APP_ID);

        if (androidOauthClients.length === 0) {
            return {
                status: 'missing_android_oauth_client',
                message: `\`google-services.json\` has no Android OAuth client for \`${APP_ID}\`. For Notive's current Capgo Google sign-in flow, this is a warning rather than a hard blocker if the SHA fingerprints and Google provider are already configured in Firebase or Google Cloud.`,
            };
        }

        return {
            status: 'ready',
            message: `Android OAuth clients: ${androidOauthClients.length}`,
            androidClientIds: Array.from(new Set(
                androidOauthClients
                    .map((client) => client?.client_id)
                    .filter((clientId) => isGoogleClientId(clientId))
            )),
            androidCertificateHashes: Array.from(new Set(
                androidOauthClients
                    .map((client) => normalizeSha1Fingerprint(client?.android_info?.certificate_hash))
                    .filter(Boolean)
            )),
        };
    } catch (error) {
        return {
            status: 'parse_error',
            message: `\`google-services.json\` could not be parsed: ${error instanceof Error ? error.message : 'unknown error'}`,
        };
    }
};

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
const androidNativeServerClientId = getAndroidNativeServerClientId();
const playAppSigningSha1 = getPlayAppSigningSha1();
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

if (androidNativeServerClientId) {
    if (!isGoogleClientId(androidNativeServerClientId)) {
        blockers.push('`NEXT_PUBLIC_GOOGLE_ANDROID_SERVER_CLIENT_ID` is malformed.');
    } else if (!backendClientIds.includes(androidNativeServerClientId)) {
        blockers.push('Backend Google SSO audience does not include `NEXT_PUBLIC_GOOGLE_ANDROID_SERVER_CLIENT_ID`.');
    } else {
        ready.push(`Android native server client: ${maskClientId(androidNativeServerClientId)}`);
    }
}

const googleServicesOauthStatus = getGoogleServicesOauthStatus();
if (googleServicesOauthStatus.status === 'ready') {
    ready.push(googleServicesOauthStatus.message);

    const missingBackendAndroidClientIds = googleServicesOauthStatus.androidClientIds
        .filter((clientId) => !backendClientIds.includes(clientId));
    if (backendClientIds.length === 0) {
        blockers.push('Backend Google SSO audience is missing. Add the web and Android OAuth client IDs from `google-services.json` to backend `GOOGLE_CLIENT_IDS`.');
    } else if (missingBackendAndroidClientIds.length > 0) {
        blockers.push(`Backend Google SSO audience does not include Android OAuth client IDs from \`google-services.json\`: ${formatMaskedClientIds(missingBackendAndroidClientIds)}. Android Google sign-in can complete on-device but fail backend verification until Railway/backend \`GOOGLE_CLIENT_IDS\` includes them.`);
    } else {
        ready.push('Backend Android OAuth audiences: match google-services.json');
    }

    if (!playAppSigningSha1) {
        warnings.push('Set optional `PLAY_APP_SIGNING_SHA1` from Play Console > App integrity to verify Android Google sign-in for Play/internal-testing installs.');
    } else if (!isSha1Fingerprint(playAppSigningSha1)) {
        blockers.push('`PLAY_APP_SIGNING_SHA1` is set but is not a valid SHA-1 fingerprint.');
    } else if (!googleServicesOauthStatus.androidCertificateHashes.includes(normalizeSha1Fingerprint(playAppSigningSha1))) {
        blockers.push('`google-services.json` is missing an Android OAuth client for the Play App Signing SHA-1. Add it in Firebase/Google Cloud for package `com.notive.app`, download the updated file, and rebuild.');
    } else {
        ready.push('Play App Signing SHA-1: present in google-services.json');
    }
} else if (
    googleServicesOauthStatus.status === 'missing_file'
    || googleServicesOauthStatus.status === 'missing_android_oauth_client'
) {
    warnings.push(googleServicesOauthStatus.message);
} else {
    blockers.push(googleServicesOauthStatus.message);
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
