import Image from 'next/image';
import Link from 'next/link';

export type LogoVariant = 'full' | 'horizontal' | 'submark' | 'wordmark' | 'monochrome' | 'square';
type LogoSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface SizeDef { width: number; height: number }

const SIZE_MAPS: Record<LogoVariant, Record<LogoSize, SizeDef>> = {
    // Portrait full lockup: feather + "Notive" + "Capture Life Gently"
    full: {
        xs: { width: 48, height: 64 },
        sm: { width: 72, height: 96 },
        md: { width: 100, height: 133 },
        lg: { width: 140, height: 187 },
        xl: { width: 190, height: 253 },
    },
    // Landscape lockup: feather quill + "Notive" side-by-side
    horizontal: {
        xs: { width: 90, height: 47 },
        sm: { width: 130, height: 68 },
        md: { width: 180, height: 95 },
        lg: { width: 240, height: 126 },
        xl: { width: 300, height: 158 },
    },
    // Icon-only feather submark (square crop)
    submark: {
        xs: { width: 28, height: 28 },
        sm: { width: 40, height: 40 },
        md: { width: 56, height: 56 },
        lg: { width: 72, height: 72 },
        xl: { width: 90, height: 90 },
    },
    // Wordmark text-only: "Notive" in sage — rendered as wide crop of centre
    wordmark: {
        xs: { width: 72, height: 18 },
        sm: { width: 108, height: 27 },
        md: { width: 150, height: 38 },
        lg: { width: 200, height: 50 },
        xl: { width: 250, height: 63 },
    },
    // Monochrome feather (black/white) — for safety mode & dark contexts
    monochrome: {
        xs: { width: 24, height: 36 },
        sm: { width: 36, height: 54 },
        md: { width: 48, height: 72 },
        lg: { width: 64, height: 96 },
        xl: { width: 80, height: 120 },
    },
    // Square app icon with rounded corners
    square: {
        xs: { width: 32, height: 32 },
        sm: { width: 48, height: 48 },
        md: { width: 64, height: 64 },
        lg: { width: 80, height: 80 },
        xl: { width: 100, height: 100 },
    },
};

const VARIANT_SRCS: Record<LogoVariant, string> = {
    full:       '/images/notive-logo.jpg',
    horizontal: '/images/Horizontal Compact Lockup.jpg',
    submark:    '/images/Submark  Icon-Only.jpg',
    wordmark:   '/images/Wordmark (Text-Only).jpg',
    monochrome: '/images/Monochrome Versions.jpg',
    square:     '/images/Square App Icon Version.jpg',
};

const VARIANT_ALTS: Record<LogoVariant, string> = {
    full:       'Notive — Capture Life Gently',
    horizontal: 'Notive',
    submark:    'Notive',
    wordmark:   'Notive',
    monochrome: 'Notive',
    square:     'Notive',
};

// full/horizontal use object-contain; all icon/mark variants use object-cover for tight cropping
const VARIANT_FIT: Record<LogoVariant, string> = {
    full:       'object-contain',
    horizontal: 'object-contain',
    submark:    'object-cover',
    wordmark:   'object-cover',
    monochrome: 'object-cover',
    square:     'object-cover',
};

const VARIANT_ROUNDED: Record<LogoVariant, string> = {
    full:       'rounded-xl',
    horizontal: '',
    submark:    'rounded-xl',
    wordmark:   '',
    monochrome: '',
    square:     'rounded-xl',
};

interface NotiveLogoProps {
    size?: LogoSize;
    variant?: LogoVariant;
    href?: string;
    className?: string;
}

export default function NotiveLogo({ size = 'md', variant = 'full', href, className = '' }: NotiveLogoProps) {
    const { width, height } = SIZE_MAPS[variant][size];

    const img = (
        <span
            className={`relative inline-flex shrink-0 overflow-hidden ${VARIANT_ROUNDED[variant]} ${className}`.trim()}
            style={{ width, height }}
        >
            <Image
                src={VARIANT_SRCS[variant]}
                alt={VARIANT_ALTS[variant]}
                fill
                sizes={`${width}px`}
                className={VARIANT_FIT[variant]}
                priority
            />
        </span>
    );

    if (href) {
        return (
            <Link href={href} className="inline-flex">
                {img}
            </Link>
        );
    }

    return img;
}
