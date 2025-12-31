import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'Notive | AI Journal',
        short_name: 'Notive',
        description: 'Your AI-powered journaling companion.',
        start_url: '/',
        display: 'standalone',
        background_color: '#0f172a',
        theme_color: '#6d28d9',
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
