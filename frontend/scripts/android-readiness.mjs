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
const gradleProperties = fs.existsSync(gradlePropertiesPath)
    ? parseEnv(fs.readFileSync(gradlePropertiesPath, 'utf8'))
    : {};

const isMissing = (value) =>
    !value
    || value === 'your-google-client-id'
    || value === 'your_google_client_id_here.apps.googleusercontent.com'
    || value === 'your-google-client-id-here'
    || value === 'your-google-client-id-here.apps.googleusercontent.com'
    || value === 'replace_with_store_password'
    || value === 'replace_with_key_password';

const isGoogleClientId = (value) => /\.apps\.googleusercontent\.com$/i.test(value || '');

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
        blockers.push('`NOTIVE_VERSION_CODE` must be an integer, for example `1100` for version `1.100`.');
        return;
    }

    const versionMatch = versionNameRaw.match(/^(\d+)\.(\d+)$/);
    if (!versionMatch) {
        blockers.push('`NOTIVE_VERSION_NAME` must follow the `major.minor` format, for example `1.100` or `2.0`.');
        return;
    }

    const major = Number.parseInt(versionMatch[1], 10);
    const minor = Number.parseInt(versionMatch[2], 10);
    const expectedVersionCode = (major * 1000) + minor;
    const versionCode = Number.parseInt(versionCodeRaw, 10);

    if (versionCode !== expectedVersionCode) {
        blockers.push(`Android version mismatch: versionName \`${versionNameRaw}\` should map to versionCode \`${expectedVersionCode}\`, but the current value is \`${versionCodeRaw}\`.`);
        return;
    }

    pushStatus('Android app version', `${versionNameRaw} (${versionCodeRaw})`);
};

resolveAndroidVersionConfig();

const googleClientId = env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID || env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
if (isMissing(googleClientId) || !isGoogleClientId(googleClientId)) {
    blockers.push('Set a real `NEXT_PUBLIC_GOOGLE_CLIENT_ID` or `NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID` in `frontend/.env` for web and Android Google sign-in.');
} else {
    pushStatus('Google credential sign-in', 'configured');
}

const nativeApiUrl = env.NEXT_PUBLIC_NATIVE_API_URL || env.NEXT_PUBLIC_API_URL || '';
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

        if (!appEntry || !Array.isArray(fingerprints) || fingerprints.length === 0) {
            launchBlockers.push(`\`assetlinks.json\` does not include package \`${APP_ID}\` with SHA-256 fingerprints.`);
        } else {
            pushStatus('Verified app links', `assetlinks.json present for ${APP_HOST}`);
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
console.log(`Environment source: ${path.relative(projectRoot, envFilePath)}`);

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
