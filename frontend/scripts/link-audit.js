#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, 'src');
const APP_DIR = path.join(SRC_DIR, 'app');
const TARGET_EXTENSIONS = new Set(['.tsx', '.ts']);

const LINK_PATTERNS = [
    { type: 'next-link', regex: /<Link[^>]*\bhref\s*=\s*["']([^"']+)["']/g },
    { type: 'anchor', regex: /<a[^>]*\bhref\s*=\s*["']([^"']+)["']/g },
    { type: 'router-nav', regex: /router\.(?:push|replace)\(\s*["']([^"']+)["']/g },
    { type: 'window-nav', regex: /window\.location\.href\s*=\s*["']([^"']+)["']/g },
];

const IGNORED_PREFIXES = ['/api', '/_next', '/__nextjs', '/favicon', '/manifest', '/robots', '/sitemap'];

function walkFiles(dir) {
    const results = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const nextPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results.push(...walkFiles(nextPath));
            continue;
        }
        const ext = path.extname(entry.name);
        if (TARGET_EXTENSIONS.has(ext)) {
            results.push(nextPath);
        }
    }
    return results;
}

function normalizeRoute(rawTarget) {
    if (typeof rawTarget !== 'string') return null;
    if (!rawTarget.startsWith('/') || rawTarget.startsWith('//')) return null;
    if (IGNORED_PREFIXES.some((prefix) => rawTarget.startsWith(prefix))) return null;
    const pathOnly = rawTarget.split(/[?#]/)[0] || '/';
    if (pathOnly === '/') return '/';
    return pathOnly.replace(/\/+$/, '') || '/';
}

function lineNumberAt(content, index) {
    let line = 1;
    for (let i = 0; i < index; i += 1) {
        if (content.charCodeAt(i) === 10) line += 1;
    }
    return line;
}

function collectAppRoutes() {
    if (!fs.existsSync(APP_DIR)) return new Set(['/']);
    const files = walkFiles(APP_DIR).filter((file) => file.endsWith(`${path.sep}page.tsx`) || file.endsWith('page.tsx'));
    const routes = new Set();

    for (const file of files) {
        const rel = path.relative(APP_DIR, file).replace(/\\/g, '/');
        const routePart = rel.replace(/\/?page\.tsx$/, '');
        if (!routePart) {
            routes.add('/');
        } else {
            routes.add(`/${routePart}`);
        }
    }

    routes.add('/');
    return routes;
}

function run() {
    if (!fs.existsSync(SRC_DIR)) {
        console.error('Expected src directory at', SRC_DIR);
        process.exit(1);
    }

    const routes = collectAppRoutes();
    const files = walkFiles(SRC_DIR);
    const missing = [];
    let scannedTargets = 0;

    for (const file of files) {
        const content = fs.readFileSync(file, 'utf8');
        for (const pattern of LINK_PATTERNS) {
            pattern.regex.lastIndex = 0;
            let match = pattern.regex.exec(content);
            while (match) {
                const rawTarget = match[1];
                const normalized = normalizeRoute(rawTarget);
                if (normalized) {
                    scannedTargets += 1;
                    if (!routes.has(normalized)) {
                        missing.push({
                            file: path.relative(ROOT, file).replace(/\\/g, '/'),
                            line: lineNumberAt(content, match.index),
                            target: rawTarget,
                            normalized,
                            type: pattern.type,
                        });
                    }
                }
                match = pattern.regex.exec(content);
            }
        }
    }

    console.log('Link Audit Report');
    console.log('-----------------');
    console.log(`App routes: ${routes.size}`);
    console.log(`Scanned link targets: ${scannedTargets}`);
    console.log(`Missing internal targets: ${missing.length}`);

    if (missing.length > 0) {
        for (const issue of missing) {
            console.log(`${issue.file}:${issue.line} [${issue.type}] ${issue.target} -> ${issue.normalized}`);
        }
        process.exit(1);
    }
}

run();

