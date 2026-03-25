#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, 'src');
const GLOBALS_CSS = path.join(SRC_DIR, 'app', 'globals.css');
const THRESHOLDS_PATH = path.join(ROOT, 'ui-thresholds.json');

const TARGET_EXTENSIONS = new Set(['.tsx', '.ts', '.css']);

const PATTERNS = {
    rawSlateUtilities: /(?:^|[\s'"])(?:text|bg|border|from|to|via)-slate-[0-9]{2,3}(?:\/[0-9]{1,3})?(?=$|[\s'"])/g,
    tinyTextUtilities: /text-\[(?:9|10|11)px\]/g,
    rawGlassClass: /className\s*=\s*["'`][^"'`]*\bglass\b(?!-)[^"'`]*["'`]/g,
};

const FOCUS_ROUTE_PATTERNS = {
    linkElements: /<Link\b/g,
    buttonElements: /<button\b/g,
    sectionElements: /<section\b/g,
};

const FOCUS_ROUTE_FILES = [
    path.join(SRC_DIR, 'app', 'dashboard', 'page.tsx'),
    path.join(SRC_DIR, 'app', 'entry', 'new', 'page.tsx'),
    path.join(SRC_DIR, 'app', 'chat', 'page.tsx'),
    path.join(SRC_DIR, 'app', 'import', 'page.tsx'),
    path.join(SRC_DIR, 'app', 'insights', 'page.tsx'),
    path.join(SRC_DIR, 'app', 'timeline', 'page.tsx'),
    path.join(SRC_DIR, 'components', 'import', 'SocialImportPanel.tsx'),
    path.join(SRC_DIR, 'components', 'portfolio', 'PortfolioWorkspace.tsx'),
    path.join(SRC_DIR, 'components', 'profile', 'ProfileClient.tsx'),
    path.join(SRC_DIR, 'components', 'profile', 'edit', 'ProfileSettingsEditor.tsx'),
];

const REQUIRED_GLOBAL_CLASSES = [
    '.glass',
    '.animate-slide-up',
    '.animate-slide-in-right',
    '.animate-confetti',
    '.animate-celebration',
];

const REQUIRED_KEYFRAMES = [
    '@keyframes slide-up',
    '@keyframes slide-in-right',
    '@keyframes confetti',
    '@keyframes celebration',
];

function walkFiles(dir) {
    const results = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const next = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results.push(...walkFiles(next));
            continue;
        }

        const ext = path.extname(entry.name);
        if (TARGET_EXTENSIONS.has(ext)) {
            results.push(next);
        }
    }
    return results;
}

function countPatternMatches(content, pattern) {
    const matches = content.match(pattern);
    return matches ? matches.length : 0;
}

function loadThresholds() {
    if (!fs.existsSync(THRESHOLDS_PATH)) {
        return null;
    }
    try {
        const raw = fs.readFileSync(THRESHOLDS_PATH, 'utf8');
        return JSON.parse(raw);
    } catch (error) {
        console.error('Failed to parse ui-thresholds.json');
        console.error(error);
        process.exit(1);
    }
}

function toPosixRelative(file) {
    return path.relative(ROOT, file).split(path.sep).join('/');
}

function run() {
    if (!fs.existsSync(SRC_DIR)) {
        console.error('Expected src directory at', SRC_DIR);
        process.exit(1);
    }

    const files = walkFiles(SRC_DIR);
    const counters = {
        rawSlateUtilities: 0,
        tinyTextUtilities: 0,
        rawGlassClass: 0,
    };
    const focusRouteCounters = Object.fromEntries(
        FOCUS_ROUTE_FILES.map((file) => [
            toPosixRelative(file),
            {
                linkElements: 0,
                buttonElements: 0,
                sectionElements: 0,
                tinyTextUtilities: 0,
            },
        ])
    );

    for (const file of files) {
        const content = fs.readFileSync(file, 'utf8');
        counters.rawSlateUtilities += countPatternMatches(content, PATTERNS.rawSlateUtilities);
        counters.tinyTextUtilities += countPatternMatches(content, PATTERNS.tinyTextUtilities);
        counters.rawGlassClass += countPatternMatches(content, PATTERNS.rawGlassClass);

        const relativeFile = toPosixRelative(file);
        if (focusRouteCounters[relativeFile]) {
            focusRouteCounters[relativeFile].linkElements = countPatternMatches(content, FOCUS_ROUTE_PATTERNS.linkElements);
            focusRouteCounters[relativeFile].buttonElements = countPatternMatches(content, FOCUS_ROUTE_PATTERNS.buttonElements);
            focusRouteCounters[relativeFile].sectionElements = countPatternMatches(content, FOCUS_ROUTE_PATTERNS.sectionElements);
            focusRouteCounters[relativeFile].tinyTextUtilities = countPatternMatches(content, PATTERNS.tinyTextUtilities);
        }
    }

    const globalsCss = fs.existsSync(GLOBALS_CSS) ? fs.readFileSync(GLOBALS_CSS, 'utf8') : '';
    const missingClasses = REQUIRED_GLOBAL_CLASSES.filter((value) => !globalsCss.includes(value));
    const missingKeyframes = REQUIRED_KEYFRAMES.filter((value) => !globalsCss.includes(value));

    const report = {
        scannedFiles: files.length,
        counters,
        focusRouteCounters,
        missingClasses,
        missingKeyframes,
    };

    console.log('UI Audit Report');
    console.log('---------------');
    console.log(`Scanned files: ${report.scannedFiles}`);
    console.log(`Raw slate utility usage: ${report.counters.rawSlateUtilities}`);
    console.log(`Tiny text utilities (9/10/11px): ${report.counters.tinyTextUtilities}`);
    console.log(`Legacy raw "glass" class usage: ${report.counters.rawGlassClass}`);
    console.log(`Missing global classes: ${report.missingClasses.length > 0 ? report.missingClasses.join(', ') : 'none'}`);
    console.log(`Missing keyframes: ${report.missingKeyframes.length > 0 ? report.missingKeyframes.join(', ') : 'none'}`);
    console.log('Focus route complexity:');
    Object.entries(report.focusRouteCounters).forEach(([file, values]) => {
        console.log(`- ${file}: ${values.linkElements} links, ${values.buttonElements} buttons, ${values.sectionElements} sections, ${values.tinyTextUtilities} tiny-text utilities`);
    });

    const strictMode = process.env.CI_UI_STRICT === '1';
    if (!strictMode) {
        return;
    }

    const thresholds = loadThresholds();
    if (!thresholds) {
        console.error('Strict mode requested but ui-thresholds.json was not found.');
        process.exit(1);
    }

    let hasFailure = false;
    const thresholdKeys = ['rawSlateUtilities', 'tinyTextUtilities', 'rawGlassClass'];
    for (const key of thresholdKeys) {
        const limit = thresholds[key];
        const value = counters[key];
        if (typeof limit === 'number' && value > limit) {
            console.error(`Threshold exceeded for ${key}: ${value} > ${limit}`);
            hasFailure = true;
        }
    }

    if (thresholds.focusRoutes && typeof thresholds.focusRoutes === 'object') {
        Object.entries(thresholds.focusRoutes).forEach(([file, limits]) => {
            const routeReport = focusRouteCounters[file];
            if (!routeReport || !limits || typeof limits !== 'object') {
                return;
            }

            Object.entries(limits).forEach(([metric, limit]) => {
                const value = routeReport[metric];
                if (typeof limit === 'number' && typeof value === 'number' && value > limit) {
                    console.error(`Threshold exceeded for ${file} ${metric}: ${value} > ${limit}`);
                    hasFailure = true;
                }
            });
        });
    }

    if (missingClasses.length > 0 || missingKeyframes.length > 0) {
        hasFailure = true;
    }

    if (hasFailure) {
        process.exit(1);
    }
}

run();
