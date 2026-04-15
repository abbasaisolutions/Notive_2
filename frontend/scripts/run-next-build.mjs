import { spawnSync } from 'node:child_process';
import path from 'node:path';

const mode = (process.argv[2] || 'web').trim().toLowerCase();
const isExportBuild = mode === 'export' || mode === 'mobile';

if (!['web', 'export', 'mobile'].includes(mode)) {
    console.error(`Unsupported build mode "${mode}". Use "web" or "export".`);
    process.exit(1);
}

const env = {
    ...process.env,
};

if (isExportBuild) {
    env.NEXT_OUTPUT_MODE = 'export';
} else {
    delete env.NEXT_OUTPUT_MODE;
}

const result = spawnSync(
    process.execPath,
    [path.resolve(import.meta.dirname, '../node_modules/next/dist/bin/next'), 'build'],
    {
        stdio: 'inherit',
        env,
    }
);

if (result.error) {
    console.error(result.error.message);
    process.exit(1);
}

process.exit(result.status ?? 0);
