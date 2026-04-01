import Image from 'next/image';
import Link from 'next/link';

type LogoSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const SIZE_MAP: Record<LogoSize, { width: number; height: number }> = {
    xs: { width: 48, height: 64 },
    sm: { width: 72, height: 96 },
    md: { width: 100, height: 133 },
    lg: { width: 140, height: 187 },
    xl: { width: 190, height: 253 },
};

interface NotiveLogoProps {
    size?: LogoSize;
    href?: string;
    className?: string;
}

export default function NotiveLogo({ size = 'md', href, className = '' }: NotiveLogoProps) {
    const { width, height } = SIZE_MAP[size];

    const img = (
        <Image
            src="/images/notive-logo.jpeg"
            alt="Notive — Capture Life Gently"
            width={width}
            height={height}
            className={`rounded-xl object-contain ${className}`}
            priority
        />
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
