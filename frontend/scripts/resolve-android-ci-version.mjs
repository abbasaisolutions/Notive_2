import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const projectRoot = path.resolve(import.meta.dirname, '..');
const gradlePropertiesPath = path.join(projectRoot, 'android', 'gradle.properties');
const writeGithubOutput = process.argv.includes('--github-output');

const gradleProperties = fs.readFileSync(gradlePropertiesPath, 'utf8');

const versionCodeMatch = gradleProperties.match(/^NOTIVE_VERSION_CODE=(\d+)$/m);
const versionNameMatch = gradleProperties.match(/^NOTIVE_VERSION_NAME=(\d+)\.(\d+)\.(\d+)$/m);

if (!versionCodeMatch || !versionNameMatch) {
    throw new Error('Unable to read NOTIVE_VERSION_CODE and NOTIVE_VERSION_NAME from frontend/android/gradle.properties.');
}

const currentVersionCode = Number.parseInt(versionCodeMatch[1], 10);
const currentVersionName = `${versionNameMatch[1]}.${versionNameMatch[2]}.${versionNameMatch[3]}`;
const major = Number.parseInt(versionNameMatch[1], 10);
const minor = Number.parseInt(versionNameMatch[2], 10);

const buildNumberRaw = (process.env.ANDROID_BUILD_NUMBER || process.env.GITHUB_RUN_NUMBER || '').trim();
if (!/^\d+$/.test(buildNumberRaw)) {
    throw new Error('Set ANDROID_BUILD_NUMBER or GITHUB_RUN_NUMBER to a positive integer for CI Android versioning.');
}

const versionCodeOffsetRaw = (process.env.ANDROID_VERSION_CODE_OFFSET || '10000').trim();
if (!/^\d+$/.test(versionCodeOffsetRaw)) {
    throw new Error('ANDROID_VERSION_CODE_OFFSET must be a positive integer.');
}

const buildNumber = Number.parseInt(buildNumberRaw, 10);
const versionCodeOffset = Number.parseInt(versionCodeOffsetRaw, 10);
const nextVersionCode = Math.max(currentVersionCode + 1, versionCodeOffset + buildNumber);
const nextVersionName = `${major}.${minor}.${buildNumber}`;

console.log(`Android CI version: ${currentVersionName} (${currentVersionCode}) -> ${nextVersionName} (${nextVersionCode})`);

if (writeGithubOutput) {
    if (!process.env.GITHUB_OUTPUT) {
        throw new Error('GITHUB_OUTPUT is required when using --github-output.');
    }

    fs.appendFileSync(
        process.env.GITHUB_OUTPUT,
        `versionCode=${nextVersionCode}\nversionName=${nextVersionName}\n`,
    );
}
