import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'Notive | Save moments. See patterns. Build your story.',
        short_name: 'Notive',
        description: 'Save real moments, understand your patterns, and build your story for life, school, and work.',
        start_url: '/',
        display: 'standalone',
        background_color: '#f8f4ed',
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
