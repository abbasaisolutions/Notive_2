'use client';

import React from 'react';

type UserAvatarProps = {
    avatarUrl?: string | null;
    name?: string | null;
    size?: number;
    className?: string;
};

export default function UserAvatar({ avatarUrl, name, size = 28, className = '' }: UserAvatarProps) {
    const initial = name?.charAt(0).toUpperCase() || '?';
    const hasAvatar = typeof avatarUrl === 'string' && avatarUrl.trim().length > 0;

    return (
        <div
            className={`flex items-center justify-center overflow-hidden rounded-full shrink-0 ${className}`}
            style={{
                width: size,
                height: size,
                background: 'linear-gradient(135deg, rgb(var(--brand)), rgb(var(--accent)))',
                fontSize: size * 0.4,
                color: '#fff',
                fontWeight: 600,
            }}
        >
            {hasAvatar ? (
                <img
                    src={avatarUrl!}
                    alt={name || 'User'}
                    crossOrigin="anonymous"
                    className="h-full w-full object-cover"
                    onError={(e) => {
                        // Fallback to initial if image fails to load
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        target.parentElement!.textContent = initial;
                    }}
                />
            ) : (
                initial
            )}
        </div>
    );
}
