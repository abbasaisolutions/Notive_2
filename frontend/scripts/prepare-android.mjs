import { existsSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const projectRoot = path.resolve(import.meta.dirname, '..');
const generatedPaths = [
    '.next',
    'out',
    'android/app/src/main/assets/public',
    'android/app/src/main/assets/capacitor.config.json',
    'android/app/src/main/assets/capacitor.plugins.json',
];

const requiredExportFiles = [
    'out/index.html',
    'out/manifest.webmanifest',
];

const requiredAndroidFiles = [
    'android/app/src/main/assets/public/index.html',
    'android/app/src/main/assets/public/manifest.webmanifest',
];

const resolveProjectPath = (...segments) => path.resolve(projectRoot, ...segments);

const removeIfPresent = (relativePath) => {
    const absolutePath = resolveProjectPath(relativePath);

    if (!existsSync(absolutePath)) {
        return;
    }

    rmSync(absolutePath, { force: true, recursive: true });
    console.log(`- removed ${relativePath}`);
};

const ensureExists = (relativePath) => {
    if (!existsSync(resolveProjectPath(relativePath))) {
        throw new Error(`Required file not found: ${relativePath}`);
    }
};

const walkFiles = (directoryPath) => {
    const absolutePath = resolveProjectPath(directoryPath);

    if (!existsSync(absolutePath)) {
        return [];
    }

    return readdirSync(absolutePath, { withFileTypes: true }).flatMap((entry) => {
        const entryAbsolutePath = path.join(absolutePath, entry.name);
        const entryRelativePath = path.relative(projectRoot, entryAbsolutePath);

        if (entry.isDirectory()) {
            return walkFiles(entryRelativePath);
        }

        return entry.isFile() ? [entryRelativePath] : [];
    });
};

const assertNoLegacyManifestReferences = (directoryPath) => {
    const htmlFiles = walkFiles(directoryPath).filter((filePath) => filePath.toLowerCase().endsWith('.html'));

    for (const filePath of htmlFiles) {
        const contents = readFileSync(resolveProjectPath(filePath), 'utf8');

        if (contents.includes('/manifest.json') || contents.includes('manifest.json')) {
            throw new Error(`Legacy manifest.json reference found in ${filePath}`);
        }
    }
};

const assertNoRemovedLogoAssets = (directoryPath) => {
    const logoDirectory = resolveProjectPath(directoryPath, 'logos');

    if (existsSync(logoDirectory) && statSync(logoDirectory).isDirectory()) {
        throw new Error(`Removed logo assets were synced again at ${path.relative(projectRoot, logoDirectory)}`);
    }
};

const cleanGeneratedArtifacts = () => {
    for (const generatedPath of generatedPaths) {
        removeIfPresent(generatedPath);
    }
};

const verifyExportArtifacts = () => {
    for (const requiredFile of requiredExportFiles) {
        ensureExists(requiredFile);
    }

    if (existsSync(resolveProjectPath('out/manifest.json'))) {
        throw new Error('Unexpected legacy out/manifest.json was generated');
    }

    assertNoLegacyManifestReferences('out');
    assertNoRemovedLogoAssets('out');
};

const verifyAndroidArtifacts = () => {
    for (const requiredFile of requiredAndroidFiles) {
        ensureExists(requiredFile);
    }

    if (existsSync(resolveProjectPath('android/app/src/main/assets/public/manifest.json'))) {
        throw new Error('Unexpected legacy Android manifest.json was generated');
    }

    assertNoLegacyManifestReferences('android/app/src/main/assets/public');
    assertNoRemovedLogoAssets('android/app/src/main/assets/public');
};

const mode = (process.argv[2] || 'clean').trim().toLowerCase();

try {
    switch (mode) {
        case 'clean':
            console.log('Cleaning generated Android build artifacts');
            cleanGeneratedArtifacts();
            break;
        case 'verify-export':
            console.log('Verifying exported web assets');
            verifyExportArtifacts();
            break;
        case 'verify-android':
            console.log('Verifying synced Android assets');
            verifyAndroidArtifacts();
            break;
        default:
            throw new Error(`Unsupported mode "${mode}". Use clean, verify-export, or verify-android.`);
    }
} catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
}
