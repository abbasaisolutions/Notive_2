const http = require('http');
const fs = require('fs');
const path = require('path');

const MIME_TYPES = {
    '.css': 'text/css; charset=utf-8',
    '.gif': 'image/gif',
    '.html': 'text/html; charset=utf-8',
    '.ico': 'image/x-icon',
    '.jpeg': 'image/jpeg',
    '.jpg': 'image/jpeg',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.map': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.txt': 'text/plain; charset=utf-8',
    '.webmanifest': 'application/manifest+json; charset=utf-8',
    '.webp': 'image/webp',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
};

const candidateRoots = [
    path.resolve(__dirname, '../src/out'),
    path.resolve(__dirname, '../out'),
];

const rootDir = candidateRoots.find((candidate) => fs.existsSync(candidate));

if (!rootDir) {
    console.error('Static export output not found. Run "npm run build" before "npm start".');
    process.exit(1);
}

const port = Number.parseInt(process.env.PORT || '3000', 10);
const host = process.env.HOST || '0.0.0.0';

const sanitizePathname = (pathname) => {
    const decoded = decodeURIComponent(pathname || '/');
    const normalized = path.posix.normalize(decoded);
    return normalized.startsWith('/') ? normalized : `/${normalized}`;
};

const resolveFilePath = (requestPath) => {
    const safePath = sanitizePathname(requestPath);
    const relativePath = safePath === '/' ? '/index.html' : safePath;
    const candidates = [
        path.join(rootDir, relativePath),
        path.join(rootDir, `${relativePath.replace(/\/$/, '')}.html`),
        path.join(rootDir, relativePath, 'index.html'),
    ];

    for (const candidate of candidates) {
        const normalized = path.normalize(candidate);
        if (!normalized.startsWith(rootDir)) continue;
        if (fs.existsSync(normalized) && fs.statSync(normalized).isFile()) {
            return { filePath: normalized, statusCode: 200 };
        }
    }

    const fallback = path.join(rootDir, '404.html');
    return { filePath: fallback, statusCode: fs.existsSync(fallback) ? 404 : 404 };
};

const server = http.createServer((req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const { filePath, statusCode } = resolveFilePath(url.pathname);

    if (!fs.existsSync(filePath)) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not found');
        return;
    }

    const extension = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[extension] || 'application/octet-stream';

    res.writeHead(statusCode, { 'Content-Type': contentType });

    if (req.method === 'HEAD') {
        res.end();
        return;
    }

    const stream = fs.createReadStream(filePath);
    stream.on('error', () => {
        if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        }
        res.end('Failed to read asset');
    });
    stream.pipe(res);
});

server.listen(port, host, () => {
    console.log(`Serving static export from ${rootDir}`);
    console.log(`Notive frontend is available at http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`);
});
