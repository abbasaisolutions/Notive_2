const path = require('path');

/** @type {import('next').NextConfig} */
const outputMode = process.env.NEXT_OUTPUT_MODE === 'export' ? 'export' : undefined;
const CANONICAL_PRODUCTION_API_URL = 'https://notive2-production.up.railway.app/api/v1';
const BROKEN_PRODUCTION_API_ALIASES = new Set([
    'https://api.abbasaisolutions.com/api/v1',
]);

const normalizeUrl = (value) => value.replace(/\/$/, '');
const resolveProxyApiUrl = () => {
    const configuredUrl = normalizeUrl((process.env.NEXT_PUBLIC_API_URL || '').trim());
    if (!configuredUrl) return CANONICAL_PRODUCTION_API_URL;

    return BROKEN_PRODUCTION_API_ALIASES.has(configuredUrl)
        ? CANONICAL_PRODUCTION_API_URL
        : configuredUrl;
};

const nextConfig = {
    ...(outputMode ? { output: outputMode } : {}),
    experimental: {
        optimizePackageImports: ['react-icons', 'framer-motion'],
    },
    webpack(config) {
        config.resolve.alias = {
            ...config.resolve.alias,
            '@': path.resolve(__dirname, 'src'),
        };

        return config;
    },
    ...(outputMode
        ? {
            images: {
                unoptimized: true,
            },
        }
        : {}),
    async headers() {
        return [
            {
                source: '/:path*',
                headers: [
                    {
                        key: 'Cross-Origin-Opener-Policy',
                        value: 'same-origin-allow-popups',
                    },
                ],
            },
        ];
    },
    ...(outputMode
        ? {}
        : {
            async rewrites() {
                return [
                    {
                        source: '/api/v1/:path*',
                        destination: `${resolveProxyApiUrl()}/:path*`,
                    },
                ];
            },
        }),
};

module.exports = nextConfig;
