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
