import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

/**
 * Reads the release version from frontend/android/gradle.properties — the single
 * source of truth for both local and CI builds.
 *
 * This replaces an earlier CI script that *derived* a version from the GitHub run
 * number. That meant a local build and a CI build of the same commit shipped
 * different versions, and the committed versionCode drifted from what actually
 * reached Play — which is how versionCode 10103 got built twice.
 *
 * Bump the version with `npm run android:version:patch` and commit it. Nothing
 * else may invent one.
 */

const projectRoot = path.resolve(import.meta.dirname, '..');
const gradlePropertiesPath = path.join(projectRoot, 'android', 'gradle.properties');
const writeGithubOutput = process.argv.includes('--github-output');

const gradleProperties = fs.readFileSync(gradlePropertiesPath, 'utf8');

const versionCodeMatch = gradleProperties.match(/^NOTIVE_VERSION_CODE=(\d+)$/m);
const versionNameMatch = gradleProperties.match(/^NOTIVE_VERSION_NAME=(\d+\.\d+\.\d+)$/m);

if (!versionCodeMatch || !versionNameMatch) {
    throw new Error('Unable to read NOTIVE_VERSION_CODE and NOTIVE_VERSION_NAME from frontend/android/gradle.properties.');
}

const versionCode = versionCodeMatch[1];
const versionName = versionNameMatch[1];

console.log(`Android release version: ${versionName} (${versionCode})`);

if (writeGithubOutput) {
    if (!process.env.GITHUB_OUTPUT) {
        throw new Error('GITHUB_OUTPUT is required when using --github-output.');
    }

    fs.appendFileSync(
        process.env.GITHUB_OUTPUT,
        `versionCode=${versionCode}\nversionName=${versionName}\n`,
    );
}
