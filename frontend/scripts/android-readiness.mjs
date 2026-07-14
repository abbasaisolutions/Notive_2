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
    const match = value.match(/^(\d+)-([^.]+)\.apps\.googleusercontent\.com$/i);
    if (match) {
        const [, projectNumber, clientSlug] = match;
        return `${projectNumber}-${clientSlug.slice(0, 8)}...${clientSlug.slice(-6)}.apps.googleusercontent.com`;
    }
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
            ...(process.env.GOOGLE_ANDROID_CLIENT_IDS || '').split(','),
            ...(process.env.GOOGLE_IOS_CLIENT_IDS || '').split(','),
            process.env.GOOGLE_CLIENT_ID || '',
            process.env.GOOGLE_WEB_CLIENT_ID || '',
            process.env.GOOGLE_ANDROID_CLIENT_ID || '',
            process.env.GOOGLE_IOS_CLIENT_ID || '',
            backendEnv.GOOGLE_CLIENT_IDS || '',
            backendEnv.GOOGLE_ANDROID_CLIENT_IDS || '',
            backendEnv.GOOGLE_IOS_CLIENT_IDS || '',
            backendEnv.GOOGLE_CLIENT_ID || '',
            backendEnv.GOOGLE_WEB_CLIENT_ID || '',
            backendEnv.GOOGLE_ANDROID_CLIENT_ID || '',
            backendEnv.GOOGLE_IOS_CLIENT_ID || '',
        ]
            .flatMap((value) => `${value || ''}`.split(','))
            .map((value) => value.trim().replace(/^"|"$/g, ''))
            .filter((value) => !isMissing(value) && isGoogleClientId(value))
    )
);

const resolveBundledBackendGoogleClientIds = () => {
    const includeBundledValue = (
        process.env.GOOGLE_INCLUDE_BUNDLED_CLIENT_IDS
        || backendEnv.GOOGLE_INCLUDE_BUNDLED_CLIENT_IDS
        || ''
    ).trim().replace(/^"|"$/g, '').toLowerCase();
    if (includeBundledValue === 'false') {
        return [];
    }

    const bundledClientPath = path.resolve(projectRoot, '..', 'backend', 'src', 'config', 'google-oauth-clients.ts');
    if (!fs.existsSync(bundledClientPath)) {
        return [];
    }

    const content = fs.readFileSync(bundledClientPath, 'utf8');
    return Array.from(
        new Set(
            Array.from(content.matchAll(/['"]([^'"]+\.apps\.googleusercontent\.com)['"]/gi))
                .map((match) => match[1])
                .filter((value) => !isMissing(value) && isGoogleClientId(value))
        )
    );
};

const resolveEffectiveBackendGoogleClientIds = () => Array.from(
    new Set([...resolveBackendGoogleClientIds(), ...resolveBundledBackendGoogleClientIds()])
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

// ── Sign-in safety invariants ───────────────────────────────────────────────
// Google SSO and email sign-in have been broken twice by well-intentioned
// theme/night-mode changes (versionCodes 10104 and 10107; 1.1.106 and 1.1.108
// device-verified working). The social-login plugin depends on the DayNight
// theme hierarchy and on MainActivity's lifecycle staying stable through
// onCreate. These checks fail the build when either invariant is violated.
const stripJavaComments = (source) => source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');

const verifySignInSafetyInvariants = () => {
    const mainActivityPath = path.join(appRoot, 'src', 'main', 'java', 'com', 'notive', 'app', 'MainActivity.java');
    const stylesPath = path.join(appRoot, 'src', 'main', 'res', 'values', 'styles.xml');

    if (!fs.existsSync(mainActivityPath) || !fs.existsSync(stylesPath)) {
        blockers.push('Sign-in safety check could not find MainActivity.java or styles.xml. If they moved, update `scripts/android-readiness.mjs`.');
        return;
    }

    const mainActivityCode = stripJavaComments(fs.readFileSync(mainActivityPath, 'utf8'));
    const stylesXml = fs.readFileSync(stylesPath, 'utf8');
    const blockersBefore = blockers.length;

    // Invariant 1: AppTheme.NoActionBar must inherit Theme.AppCompat.DayNight.
    // Switching it to .Light broke Google SSO and email sign-in on device
    // (versionCode 10104). Fix dialog theming at the dialog level instead.
    const themeParentMatch = stylesXml.match(/name="AppTheme\.NoActionBar"\s+parent="([^"]+)"/);
    if (!themeParentMatch || themeParentMatch[1] !== 'Theme.AppCompat.DayNight.NoActionBar') {
        blockers.push(`\`AppTheme.NoActionBar\` must keep parent \`Theme.AppCompat.DayNight.NoActionBar\` (found \`${themeParentMatch ? themeParentMatch[1] : 'no match'}\`). Changing it broke Google SSO and email sign-in on device. See MainActivity.java's onCreate comment.`);
    }

    // Invariant 2: no AppCompatDelegate.setDefaultNightMode() in MainActivity.
    // Calling it (especially before super.onCreate) can recreate the Activity
    // mid-creation, tearing down the Capacitor bridge and the social-login
    // plugin's onActivityResult wiring (versionCode 10107).
    if (/setDefaultNightMode\s*\(/.test(mainActivityCode)) {
        blockers.push('`MainActivity.java` calls `AppCompatDelegate.setDefaultNightMode()`. This recreated the Activity mid-onCreate and broke Google SSO and email sign-in on device. Remove it; scope any dialog theming to the dialog itself.');
    }

    // Invariant 3: the social-login plugin's Activity wiring must stay intact.
    const socialLoginWiring = [
        ['implements ModifiedMainActivityForSocialLoginPlugin', 'MainActivity must implement `ModifiedMainActivityForSocialLoginPlugin`.'],
        ['handleGoogleLoginIntent', 'MainActivity.onActivityResult must forward results via `handleGoogleLoginIntent`.'],
    ];
    for (const [needle, message] of socialLoginWiring) {
        if (!mainActivityCode.includes(needle)) {
            blockers.push(`${message} Removing it breaks Google SSO on Android.`);
        }
    }

    if (blockers.length === blockersBefore) {
        pushStatus('Sign-in safety invariants', 'DayNight theme parent, no setDefaultNightMode, social-login wiring intact');
    }
};

verifySignInSafetyInvariants();

const googleClientId = resolveEnvValue('NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID')
    || resolveEnvValue('NEXT_PUBLIC_GOOGLE_CLIENT_ID');
if (isMissing(googleClientId) || !isGoogleClientId(googleClientId)) {
    const message = 'Set a real `NEXT_PUBLIC_GOOGLE_CLIENT_ID` or `NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID` in `frontend/.env` or CI environment variables for web and Android Google sign-in.';
    if (mode === 'launch') {
        blockers.push(message);
    } else {
        warnings.push(`${message} Release builds can continue, but Google sign-in will need a real client ID before publishing.`);
    }
} else {
    pushStatus('Google credential sign-in', 'configured');

    const backendGoogleClientIds = resolveBackendGoogleClientIds();
    const effectiveBackendGoogleClientIds = resolveEffectiveBackendGoogleClientIds();
    if (effectiveBackendGoogleClientIds.length === 0) {
        warnings.push('Backend Google SSO audience is not configured locally. Set backend `GOOGLE_CLIENT_ID` or `GOOGLE_CLIENT_IDS` to the same active web OAuth client ID used by the frontend.');
    } else if (!effectiveBackendGoogleClientIds.includes(googleClientId)) {
        warnings.push('Backend Google SSO audience does not include the frontend Google web client ID. Google sign-in can open but fail verification until backend `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_IDS` is updated.');
    } else if (!backendGoogleClientIds.includes(googleClientId)) {
        pushStatus('Backend Google SSO audience', 'bundled fallback matches frontend client');
        warnings.push('Backend GOOGLE_CLIENT_IDS does not list the frontend Google web client ID. The bundled fallback covers the current ID, but production env should stay explicit.');
    } else {
        pushStatus('Backend Google SSO audience', 'matches frontend client');
    }
}

const androidServerClientId = resolveEnvValue('NEXT_PUBLIC_GOOGLE_ANDROID_SERVER_CLIENT_ID');
if (androidServerClientId) {
    if (!isGoogleClientId(androidServerClientId)) {
        const message = '`NEXT_PUBLIC_GOOGLE_ANDROID_SERVER_CLIENT_ID` is set but malformed. It must be a valid Google OAuth client ID ending in `.apps.googleusercontent.com`.';
        if (mode === 'launch') {
            blockers.push(message);
        } else {
            warnings.push(`${message} Release builds can continue, but Android Google sign-in will need a valid client ID before publishing.`);
        }
    } else {
        pushStatus('Android native Google server client', 'configured');
        const backendGoogleClientIds = resolveBackendGoogleClientIds();
        const effectiveBackendGoogleClientIds = resolveEffectiveBackendGoogleClientIds();
        if (effectiveBackendGoogleClientIds.length === 0) {
            warnings.push('Backend Google SSO audience is not configured locally. Add the Android native Google server client ID to backend `GOOGLE_CLIENT_IDS` so native tokens verify correctly.');
        } else if (!effectiveBackendGoogleClientIds.includes(androidServerClientId)) {
            warnings.push('Backend Google SSO audience does not include `NEXT_PUBLIC_GOOGLE_ANDROID_SERVER_CLIENT_ID`. Android Google sign-in can open but fail backend verification until backend `GOOGLE_CLIENT_IDS` includes it.');
        } else if (!backendGoogleClientIds.includes(androidServerClientId)) {
            pushStatus('Backend Android Google audience', 'bundled fallback matches Android native server client');
            warnings.push('Backend GOOGLE_CLIENT_IDS does not list `NEXT_PUBLIC_GOOGLE_ANDROID_SERVER_CLIENT_ID`. The bundled fallback covers the current ID, but production env should stay explicit.');
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
            const effectiveBackendGoogleClientIds = resolveEffectiveBackendGoogleClientIds();
            const missingBackendAndroidClientIds = oauthSummary.androidClientIds
                .filter((clientId) => !effectiveBackendGoogleClientIds.includes(clientId));
            const missingEnvAndroidClientIds = oauthSummary.androidClientIds
                .filter((clientId) => !backendGoogleClientIds.includes(clientId));
            if (effectiveBackendGoogleClientIds.length === 0) {
                warnings.push('Backend Google SSO audience is not configured locally. Add the web and Android OAuth client IDs from `google-services.json` to backend `GOOGLE_CLIENT_IDS` so Android credentials verify.');
            } else if (missingBackendAndroidClientIds.length > 0) {
                const message = `Backend Google SSO audience does not include Android OAuth client IDs from \`google-services.json\`: ${formatMaskedClientIds(missingBackendAndroidClientIds)}. Android Google sign-in can complete on-device but fail backend verification until Railway/backend \`GOOGLE_CLIENT_IDS\` includes them.`;
                if (mode === 'launch') {
                    launchBlockers.push(message);
                } else {
                    warnings.push(message);
                }
            } else if (missingEnvAndroidClientIds.length > 0) {
                pushStatus('Backend Android OAuth audiences', 'bundled fallback matches google-services.json');
                warnings.push(`Backend GOOGLE_CLIENT_IDS does not list Android OAuth client IDs from \`google-services.json\`: ${formatMaskedClientIds(missingEnvAndroidClientIds)}. The bundled fallback covers the current IDs, but production env should stay explicit.`);
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
