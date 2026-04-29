#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, 'src');
const TARGET_EXTENSIONS = new Set(['.tsx', '.ts']);

const PATTERNS = [
    {
        label: 'apiFetch path includes /api prefix',
        regex: /\bapiFetch\s*\(\s*['"`]\/api(?:\/|['"`])/g,
    },
    {
        label: 'resolveApiRequestUrl path includes /api prefix',
        regex: /\bresolveApiRequestUrl\s*\(\s*['"`]\/api(?:\/|['"`])/g,
    },
    {
        label: 'API_URL template appends /api prefix',
        regex: /\$\{\s*API_URL\s*\}\/api(?:\/|[`])/g,
    },
];

function walkFiles(dir) {
    const results = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        const nextPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results.push(...walkFiles(nextPath));
            continue;
        }

        if (TARGET_EXTENSIONS.has(path.extname(entry.name))) {
            results.push(nextPath);
        }
    }

    return results;
}

function lineNumberAt(content, index) {
    let line = 1;
    for (let i = 0; i < index; i += 1) {
        if (content.charCodeAt(i) === 10) line += 1;
    }
    return line;
}

function toPosixRelative(file) {
    return path.relative(ROOT, file).split(path.sep).join('/');
}

function run() {
    if (!fs.existsSync(SRC_DIR)) {
        console.error('Expected src directory at', SRC_DIR);
        process.exit(1);
    }

    const issues = [];
    const files = walkFiles(SRC_DIR);

    for (const file of files) {
        const content = fs.readFileSync(file, 'utf8');
        for (const pattern of PATTERNS) {
            pattern.regex.lastIndex = 0;
            let match = pattern.regex.exec(content);
            while (match) {
                issues.push({
                    file: toPosixRelative(file),
                    line: lineNumberAt(content, match.index),
                    label: pattern.label,
                    match: match[0],
                });
                match = pattern.regex.exec(content);
            }
        }
    }

    console.log('API Path Audit Report');
    console.log('---------------------');
    console.log(`Scanned files: ${files.length}`);
    console.log(`Incorrect /api-prefixed client paths: ${issues.length}`);

    if (issues.length > 0) {
        for (const issue of issues) {
            console.log(`${issue.file}:${issue.line} ${issue.label}: ${issue.match}`);
        }
        process.exit(1);
    }
}

run();
