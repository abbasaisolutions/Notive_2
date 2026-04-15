'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { passthroughImageLoader } from '@/lib/image-loader';

type UserAvatarProps = {
    avatarUrl?: string | null;
    name?: string | null;
    size?: number;
    className?: string;
};

export default function UserAvatar({ avatarUrl, name, size = 28, className = '' }: UserAvatarProps) {
    const initial = name?.charAt(0).toUpperCase() || '?';
    const hasAvatar = typeof avatarUrl === 'string' && avatarUrl.trim().length > 0;
    const [imageFailed, setImageFailed] = useState(false);

    useEffect(() => {
        setImageFailed(false);
    }, [avatarUrl]);

    return (
        <div
            className={`relative flex items-center justify-center overflow-hidden rounded-full shrink-0 ${className}`}
            style={{
                width: size,
                height: size,
                background: 'linear-gradient(135deg, rgb(var(--brand)), rgb(var(--accent)))',
                fontSize: size * 0.4,
                color: '#fff',
                fontWeight: 600,
            }}
        >
            {hasAvatar && !imageFailed ? (
                <Image
                    src={avatarUrl!}
                    loader={passthroughImageLoader}
                    unoptimized
                    alt={name || 'User'}
                    fill
                    sizes={`${size}px`}
                    className="h-full w-full object-cover"
                    onError={() => setImageFailed(true)}
                />
            ) : (
                initial
            )}
        </div>
    );
}
