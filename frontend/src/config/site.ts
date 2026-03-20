const DEFAULT_APP_URL = 'https://notive.abbasaisolutions.com';

const normalizeAppUrl = (value: string | undefined) => {
    const trimmed = (value || '').trim();
    if (!trimmed) return DEFAULT_APP_URL;

    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

    try {
        const url = new URL(withProtocol);
        const pathname = url.pathname === '/' ? '' : url.pathname.replace(/\/$/, '');
        return `${url.origin}${pathname}`;
    } catch {
        return DEFAULT_APP_URL;
    }
};

export const PUBLIC_APP_URL = normalizeAppUrl(process.env.NEXT_PUBLIC_APP_URL);
export const PUBLIC_APP_ORIGIN = new URL(`${PUBLIC_APP_URL}/`);
export const PUBLIC_OG_IMAGE_URL = `${PUBLIC_APP_URL}/og-image.png`;
