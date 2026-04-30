import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const projectRoot = path.resolve(import.meta.dirname, '..');
const androidRoot = path.join(projectRoot, 'android');
const appRoot = path.join(androidRoot, 'app');
const mode = process.argv.includes('--launch') ? 'launch' : 'release';

const APP_ID = 'com.notive.app';
const APP_HOST = 'notive.abbasaisolutions.com';

const statusLines = [];
const warnings = [];
const blockers = [];
const launchBlockers = [];

const envFilePath = fs.existsSync(path.join(projectRoot, '.env'))
    ? path.join(projectRoot, '.env')
    : path.join(projectRoot, '.env.example');
const gradlePropertiesPath = path.join(androidRoot, 'gradle.properties');

const parseEnv = (content) => {
    const env = {};

    for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;

        const separatorIndex = line.indexOf('=');
        if (separatorIndex === -1) continue;

        const key = line.slice(0, separatorIndex).trim();
        const value = line.slice(separatorIndex + 1).trim();
        env[key] = value;
    }

    return env;
};

const env = parseEnv(fs.readFileSync(envFilePath, 'utf8'));
const backendEnvFilePath = path.resolve(projectRoot, '..', 'backend', '.env');
const backendEnv = fs.existsSync(backendEnvFilePath)
    ? parseEnv(fs.readFileSync(backendEnvFilePath, 'utf8'))
    : {};
const gradleProperties = fs.existsSync(gradlePropertiesPath)
    ? parseEnv(fs.readFileSync(gradlePropertiesPath, 'utf8'))
    : {};

const resolveEnvValue = (key) => {
    const processValue = (process.env[key] || '').trim();
    if (processValue) {
        return processValue;
    }

    return (env[key] || '').trim();
};

const isMissing = (value) =>
    !value
    || value === 'your-google-client-id'
    || value === 'your_google_client_id_here.apps.googleusercontent.com'
    || value === 'your_google_web_client_id_here.apps.googleusercontent.com'
    || value === 'your-google-client-id-here'
    || value === 'your-google-client-id-here.apps.googleusercontent.com'
    || value === 'replace_with_store_password'
    || value === 'replace_with_key_password';

const isGoogleClientId = (value) => /\.apps\.googleusercontent\.com$/i.test(value || '');
const normalizeSha1Fingerprint = (value) => `${value || ''}`.replace(/[^0-9a-f]/gi, '').toLowerCase();
const isSha1Fingerprint = (value) => /^[0-9a-f]{40}$/i.test(normalizeSha1Fingerprint(value));
const maskClientId = (value) => {
    if (!value) return 'missing';
    if (value.length <= 28) return 'set-but-short';
    return `${value.slice(0, 12)}...${value.slice(-18)}`;
};
const formatMaskedClientIds = (clientIds) => clientIds.map(maskClientId).join(', ');

const getGoogleServicesOauthSummary = (googleServices) => {
    const appClients = (googleServices.client || [])
        .filter((client) => client?.client_info?.android_client_info?.package_name === APP_ID);
    const directOauthClients = appClients.flatMap((client) => client?.oauth_client || []);
    const otherPlatformOauthClients = appClients
        .flatMap((client) => client?.services?.appinvite_service?.other_platform_oauth_client || []);
    const androidOauthClients = directOauthClients.filter((client) =>
        Number(client?.client_type) === 1
        && client?.android_info?.package_name === APP_ID
    );

    return {
        androidClientCount: androidOauthClients.length,
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
        webClientCount: [
            ...directOauthClients,
            ...otherPlatformOauthClients,
        ].filter((client) => Number(client?.client_type) === 3 && isGoogleClientId(client?.client_id)).length,
    };
};

const resolveBackendGoogleClientIds = () => Array.from(
    new Set(
        [
            ...(process.env.GOOGLE_CLIENT_IDS || '').split(','),
            process.env.GOOGLE_CLIENT_ID || '',
            process.env.GOOGLE_WEB_CLIENT_ID || '',
            backendEnv.GOOGLE_CLIENT_IDS || '',
            backendEnv.GOOGLE_CLIENT_ID || '',
            backendEnv.GOOGLE_WEB_CLIENT_ID || '',
        ]
            .flatMap((value) => `${value || ''}`.split(','))
            .map((value) => value.trim().replace(/^"|"$/g, ''))
            .filter((value) => !isMissing(value) && isGoogleClientId(value))
    )
);

const isLikelyLocalApiUrl = (value) =>
    /localhost|127\.0\.0\.1|0\.0\.0\.0|192\.168\.|10\.\d+|172\.(1[6-9]|2\d|3[01])\./i.test(value || '');

const pushStatus = (label, value) => {
    statusLines.push(`${label}: ${value}`);
};

const resolveAndroidVersionConfig = () => {
    const versionCodeRaw = (process.env.NOTIVE_VERSION_CODE || gradleProperties.NOTIVE_VERSION_CODE || '').trim();
    const versionNameRaw = (process.env.NOTIVE_VERSION_NAME || gradleProperties.NOTIVE_VERSION_NAME || '').trim();

    if (!versionCodeRaw || !versionNameRaw) {
        blockers.push('Set `NOTIVE_VERSION_CODE` and `NOTIVE_VERSION_NAME` in `frontend/android/gradle.properties` or CI env vars. Android is otherwise falling back to versionCode `1` and versionName `1.0.0`.');
        return;
    }

    if (!/^\d+$/.test(versionCodeRaw)) {
        blockers.push('`NOTIVE_VERSION_CODE` must be a positive integer, for example `17`.');
        return;
    }

    const versionCode = Number.parseInt(versionCodeRaw, 10);
    if (versionCode < 1) {
        blockers.push('`NOTIVE_VERSION_CODE` must be at least 1.');
        return;
    }

    if (!/^\d+\.\d+\.\d+$/.test(versionNameRaw)) {
        blockers.push('`NOTIVE_VERSION_NAME` must follow SemVer `major.minor.patch` format, for example `1.2.0`.');
        return;
    }

    pushStatus('Android app version', `${versionNameRaw} (${versionCode})`);
};

resolveAndroidVersionConfig();

const googleClientId = resolveEnvValue('NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID')
    || resolveEnvValue('NEXT_PUBLIC_GOOGLE_CLIENT_ID');
if (isMissing(googleClientId) || !isGoogleClientId(googleClientId)) {
    blockers.push('Set a real `NEXT_PUBLIC_GOOGLE_CLIENT_ID` or `NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID` in `frontend/.env` or CI environment variables for web and Android Google sign-in.');
} else {
    pushStatus('Google credential sign-in', 'configured');

    const backendGoogleClientIds = resolveBackendGoogleClientIds();
    if (backendGoogleClientIds.length === 0) {
        warnings.push('Backend Google SSO audience is not configured locally. Set backend `GOOGLE_CLIENT_ID` or `GOOGLE_CLIENT_IDS` to the same active web OAuth client ID used by the frontend.');
    } else if (!backendGoogleClientIds.includes(googleClientId)) {
        warnings.push('Backend Google SSO audience does not include the frontend Google web client ID. Google sign-in can open but fail verification until backend `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_IDS` is updated.');
    } else {
        pushStatus('Backend Google SSO audience', 'matches frontend client');
    }
}

const androidServerClientId = resolveEnvValue('NEXT_PUBLIC_GOOGLE_ANDROID_SERVER_CLIENT_ID');
if (androidServerClientId) {
    if (!isGoogleClientId(androidServerClientId)) {
        blockers.push('`NEXT_PUBLIC_GOOGLE_ANDROID_SERVER_CLIENT_ID` is set but malformed. It must be a valid Google OAuth client ID ending in `.apps.googleusercontent.com`.');
    } else {
        pushStatus('Android native Google server client', 'configured');
        const backendGoogleClientIds = resolveBackendGoogleClientIds();
        if (backendGoogleClientIds.length === 0) {
            warnings.push('Backend Google SSO audience is not configured locally. Add the Android native Google server client ID to backend `GOOGLE_CLIENT_IDS` so native tokens verify correctly.');
        } else if (!backendGoogleClientIds.includes(androidServerClientId)) {
            warnings.push('Backend Google SSO audience does not include `NEXT_PUBLIC_GOOGLE_ANDROID_SERVER_CLIENT_ID`. Android Google sign-in can open but fail backend verification until backend `GOOGLE_CLIENT_IDS` includes it.');
        } else {
            pushStatus('Backend Android Google audience', 'matches Android native server client');
        }
    }
}

const nativeApiUrl = resolveEnvValue('NEXT_PUBLIC_NATIVE_API_URL')
    || resolveEnvValue('NEXT_PUBLIC_API_URL');
if (!nativeApiUrl) {
    warnings.push('`NEXT_PUBLIC_NATIVE_API_URL` is not set. Native builds will fall back to the web API URL or production default.');
} else if (isLikelyLocalApiUrl(nativeApiUrl)) {
    warnings.push('`NEXT_PUBLIC_NATIVE_API_URL` points to a local/private network address. That is fine for QA, but not for Play Store builds.');
} else {
    pushStatus('Native API target', nativeApiUrl);
}

const keyPropertiesPath = path.join(androidRoot, 'key.properties');
const hasKeyProperties = fs.existsSync(keyPropertiesPath);
const requiredSigningEnvVars = [
    'PLAY_UPLOAD_STORE_FILE',
    'PLAY_UPLOAD_STORE_PASSWORD',
    'PLAY_UPLOAD_KEY_ALIAS',
    'PLAY_UPLOAD_KEY_PASSWORD',
];
const missingSigningEnvVars = requiredSigningEnvVars.filter((key) => !process.env[key]);

if (!hasKeyProperties && missingSigningEnvVars.length > 0) {
    blockers.push('Add `frontend/android/key.properties` or set the `PLAY_UPLOAD_*` environment variables for release signing.');
} else {
    pushStatus('Release signing', hasKeyProperties ? 'key.properties present' : 'PLAY_UPLOAD_* environment variables present');
}

const googleServicesPath = path.join(appRoot, 'google-services.json');
const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
const hasPushPlugin = Boolean(
    packageJson?.dependencies?.['@capacitor/push-notifications']
    || packageJson?.devDependencies?.['@capacitor/push-notifications']
);
if (!fs.existsSync(googleServicesPath)) {
    launchBlockers.push('Add `frontend/android/app/google-services.json` from Firebase to enable Android push notifications.');
} else {
    try {
        const googleServices = JSON.parse(fs.readFileSync(googleServicesPath, 'utf8'));
        const packageNames = (googleServices.client || [])
            .map((client) => client?.client_info?.android_client_info?.package_name)
            .filter(Boolean);

        if (!packageNames.includes(APP_ID)) {
            launchBlockers.push(`\`google-services.json\` does not contain the Android package name \`${APP_ID}\`.`);
        } else {
            pushStatus('Firebase app config', 'google-services.json present');

            const oauthSummary = getGoogleServicesOauthSummary(googleServices);
            if (oauthSummary.androidClientCount === 0) {
                warnings.push('`google-services.json` has no Android OAuth client for `com.notive.app`. Android Google sign-in can throw account reauth errors until the app package plus debug/release SHA-1/SHA-256 fingerprints are added in Firebase or Google Cloud and this file is downloaded again.');
            } else {
                pushStatus('Android Google OAuth client', `${oauthSummary.androidClientCount} configured`);
            }

            const backendGoogleClientIds = resolveBackendGoogleClientIds();
            const missingBackendAndroidClientIds = oauthSummary.androidClientIds
                .filter((clientId) => !backendGoogleClientIds.includes(clientId));
            if (backendGoogleClientIds.length === 0) {
                warnings.push('Backend Google SSO audience is not configured locally. Add the web and Android OAuth client IDs from `google-services.json` to backend `GOOGLE_CLIENT_IDS` so Android credentials verify.');
            } else if (missingBackendAndroidClientIds.length > 0) {
                const message = `Backend Google SSO audience does not include Android OAuth client IDs from \`google-services.json\`: ${formatMaskedClientIds(missingBackendAndroidClientIds)}. Android Google sign-in can complete on-device but fail backend verification until Railway/backend \`GOOGLE_CLIENT_IDS\` includes them.`;
                if (mode === 'launch') {
                    launchBlockers.push(message);
                } else {
                    warnings.push(message);
                }
            } else {
                pushStatus('Backend Android OAuth audiences', 'match google-services.json');
            }

            if (mode === 'launch') {
                const playAppSigningSha1 = resolveEnvValue('PLAY_APP_SIGNING_SHA1');
                const normalizedPlayAppSigningSha1 = normalizeSha1Fingerprint(playAppSigningSha1);

                if (!playAppSigningSha1) {
                    warnings.push('Set optional `PLAY_APP_SIGNING_SHA1` from Play Console > App integrity so this audit can verify Google sign-in for Play-signed installs. Missing the Play App Signing SHA-1 can cause Android `[16] Account reauth failed` errors even when local debug/release builds work.');
                } else if (!isSha1Fingerprint(playAppSigningSha1)) {
                    launchBlockers.push('`PLAY_APP_SIGNING_SHA1` is set but is not a valid SHA-1 fingerprint.');
                } else if (!oauthSummary.androidCertificateHashes.includes(normalizedPlayAppSigningSha1)) {
                    launchBlockers.push('`google-services.json` is missing an Android OAuth client for the Play App Signing SHA-1. Add that SHA-1 to Firebase/Google Cloud for package `com.notive.app`, download the updated `google-services.json`, and rebuild.');
                } else {
                    pushStatus('Play App Signing Google OAuth', 'matches google-services.json');
                }
            }

            if (oauthSummary.webClientCount === 0) {
                warnings.push('`google-services.json` has no Web OAuth client listed. Native Google sign-in still uses `NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID`, but keeping the Firebase file stale makes Android SSO harder to audit.');
            }
        }
    } catch {
        launchBlockers.push('`frontend/android/app/google-services.json` exists but could not be parsed.');
    }
}

if (!hasPushPlugin) {
    launchBlockers.push('Native push notifications are not implemented yet. Add `@capacitor/push-notifications` plus token registration on the app/backend side before calling Android push fully ready.');
}

const assetLinksPath = path.join(projectRoot, 'public', '.well-known', 'assetlinks.json');
if (!fs.existsSync(assetLinksPath)) {
    launchBlockers.push(`Add \`frontend/public/.well-known/assetlinks.json\` so Android can verify https app links for ${APP_HOST}.`);
} else {
    try {
        const assetLinks = JSON.parse(fs.readFileSync(assetLinksPath, 'utf8'));
        const appEntry = Array.isArray(assetLinks)
            ? assetLinks.find((entry) => entry?.target?.package_name === APP_ID)
            : null;
        const fingerprints = appEntry?.target?.sha256_cert_fingerprints || [];
        const SHA256_RE = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/i;
        const PLACEHOLDER_RE = /REPLACE|PLACEHOLDER|TODO|EXAMPLE|00:00:00/i;

        if (!appEntry || !Array.isArray(fingerprints) || fingerprints.length === 0) {
            launchBlockers.push(`\`assetlinks.json\` does not include package \`${APP_ID}\` with SHA-256 fingerprints.`);
        } else {
            const invalid = fingerprints.filter((fp) => !SHA256_RE.test(fp) || PLACEHOLDER_RE.test(fp));
            if (invalid.length > 0) {
                launchBlockers.push(`\`assetlinks.json\` contains placeholder or malformed fingerprints: ${invalid.join(', ')}. Replace with the real upload-keystore SHA-256 value.`);
            } else {
                pushStatus('Verified app links', `assetlinks.json present for ${APP_HOST}`);
            }
        }
    } catch {
        launchBlockers.push('`frontend/public/.well-known/assetlinks.json` exists but could not be parsed.');
    }
}

const debugApkPath = path.join(appRoot, 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
if (fs.existsSync(debugApkPath)) {
    const apkStats = fs.statSync(debugApkPath);
    pushStatus('Latest debug APK', `${debugApkPath} (${Math.round(apkStats.size / 1024 / 1024 * 10) / 10} MB)`);
}

console.log(`Android readiness audit (${mode === 'launch' ? 'launch' : 'release-core'})`);
console.log(`Environment source: ${path.relative(projectRoot, envFilePath)} (process env overrides file values when present)`);

if (statusLines.length > 0) {
    console.log('\nReady now');
    for (const line of statusLines) {
        console.log(`- ${line}`);
    }
}

if (warnings.length > 0) {
    console.log('\nWarnings');
    for (const warning of warnings) {
        console.log(`- ${warning}`);
    }
}

if (blockers.length > 0) {
    console.log('\nCore blockers');
    for (const blocker of blockers) {
        console.log(`- ${blocker}`);
    }
}

if (launchBlockers.length > 0) {
    console.log('\nLaunch blockers');
    for (const blocker of launchBlockers) {
        console.log(`- ${blocker}`);
    }
}

if (mode === 'launch') {
    process.exitCode = blockers.length > 0 || launchBlockers.length > 0 ? 1 : 0;
} else {
    process.exitCode = blockers.length > 0 ? 1 : 0;
}
