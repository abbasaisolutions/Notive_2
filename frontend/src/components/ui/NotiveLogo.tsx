import Image from 'next/image';
import Link from 'next/link';

type LogoSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const SIZE_MAP: Record<LogoSize, { width: number; height: number }> = {
    xs: { width: 80, height: 54 },
    sm: { width: 110, height: 74 },
    md: { width: 150, height: 101 },
    lg: { width: 200, height: 134 },
    xl: { width: 280, height: 188 },
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
            src="/images/notive-logo.png"
            alt="Notive"
            width={width}
            height={height}
            className={`object-contain ${className}`}
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
