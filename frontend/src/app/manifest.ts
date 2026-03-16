import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'Notive | Memory, Signal, and Story',
        short_name: 'Notive',
        description: 'Capture lived moments, read the patterns inside them, and turn them into usable stories.',
        start_url: '/',
        display: 'standalone',
        background_color: '#0c0f14',
        theme_color: '#64748b',
        icons: [
            {
                src: '/icon-192.png',
                sizes: '192x192',
                type: 'image/png',
            },
            {
                src: '/icon-512.png',
                sizes: '512x512',
                type: 'image/png',
            },
        ],
    };
}
