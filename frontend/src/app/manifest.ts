import { MetadataRoute } from 'next';
import { NOTIVE_VOICE } from '@/content/notive-voice';

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: `Notive | ${NOTIVE_VOICE.signature}`,
        short_name: 'Notive',
        description: NOTIVE_VOICE.longSummary,
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
