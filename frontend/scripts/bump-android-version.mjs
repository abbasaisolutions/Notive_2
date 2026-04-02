import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const projectRoot = path.resolve(import.meta.dirname, '..');
const gradlePropertiesPath = path.join(projectRoot, 'android', 'gradle.properties');

const usage = () => {
    console.log('Usage: node scripts/bump-android-version.mjs <patch|minor|major> [--dry-run]');
};

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const bumpType = args.find((value) => !value.startsWith('--'));

if (!bumpType || !['patch', 'minor', 'major'].includes(bumpType)) {
    usage();
    process.exitCode = 1;
    process.exit();
}

const gradleProperties = fs.readFileSync(gradlePropertiesPath, 'utf8');

const versionCodeMatch = gradleProperties.match(/^NOTIVE_VERSION_CODE=(\d+)$/m);
const versionNameMatch = gradleProperties.match(/^NOTIVE_VERSION_NAME=(\d+)\.(\d+)\.(\d+)$/m);

if (!versionCodeMatch || !versionNameMatch) {
    throw new Error('Unable to read NOTIVE_VERSION_CODE and NOTIVE_VERSION_NAME from frontend/android/gradle.properties.');
}

const currentVersionCode = Number.parseInt(versionCodeMatch[1], 10);
let major = Number.parseInt(versionNameMatch[1], 10);
let minor = Number.parseInt(versionNameMatch[2], 10);
let patch = Number.parseInt(versionNameMatch[3], 10);

if (bumpType === 'major') {
    major += 1;
    minor = 0;
    patch = 0;
} else if (bumpType === 'minor') {
    minor += 1;
    patch = 0;
} else {
    patch += 1;
}

const nextVersionCode = currentVersionCode + 1;
const nextVersionName = `${major}.${minor}.${patch}`;

const updatedGradleProperties = gradleProperties
    .replace(/^NOTIVE_VERSION_CODE=\d+$/m, `NOTIVE_VERSION_CODE=${nextVersionCode}`)
    .replace(/^NOTIVE_VERSION_NAME=\d+\.\d+\.\d+$/m, `NOTIVE_VERSION_NAME=${nextVersionName}`);

console.log(`Android version: ${versionNameMatch[0].split('=')[1]} (${currentVersionCode}) -> ${nextVersionName} (${nextVersionCode})`);

if (dryRun) {
    console.log('Dry run only, no files changed.');
    process.exit(0);
}

fs.writeFileSync(gradlePropertiesPath, updatedGradleProperties);
console.log(`Updated ${path.relative(projectRoot, gradlePropertiesPath)}`);
