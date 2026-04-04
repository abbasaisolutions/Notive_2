'use client';

import React, { useRef, useState } from 'react';
import { FiCamera, FiTrash2 } from 'react-icons/fi';
import useApi from '@/hooks/use-api';

const ACCEPTED_TYPES = 'image/jpeg,image/png,image/webp';
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

type AvatarUploadProps = {
    avatarUrl: string;
    name: string;
    onAvatarChange: (url: string) => void;
};

export default function AvatarUpload({ avatarUrl, name, onAvatarChange }: AvatarUploadProps) {
    const { apiFetch } = useApi();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState('');

    const initial = name?.charAt(0).toUpperCase() || '?';
    const hasAvatar = avatarUrl.trim().length > 0;

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Reset input so the same file can be re-selected
        e.target.value = '';

        if (!file.type.match(/^image\/(jpeg|png|webp)$/)) {
            setError('Please select a JPG, PNG, or WebP image.');
            return;
        }

        if (file.size > MAX_SIZE_BYTES) {
            setError('Image must be under 5 MB.');
            return;
        }

        setError('');
        setIsUploading(true);

        try {
            const formData = new FormData();
            formData.append('file', file);

            const res = await apiFetch('/files/upload', {
                method: 'POST',
                body: formData,
            });

            if (!res.ok) {
                const data = await res.json().catch(() => null);
                throw new Error(data?.message || 'Upload failed');
            }

            const data = await res.json();
            onAvatarChange(data.url);
        } catch (err: any) {
            setError(err.message || 'Failed to upload image.');
        } finally {
            setIsUploading(false);
        }
    };

    const handleRemove = () => {
        setError('');
        onAvatarChange('');
    };

    return (
        <div className="space-y-2">
            <label className="workspace-field-label ml-1">Profile photo</label>
            <div className="flex items-center gap-4">
                {/* Avatar preview */}
                <div className="relative h-20 w-20 shrink-0">
                    <div
                        className="flex h-full w-full items-center justify-center overflow-hidden rounded-[1.3rem] text-2xl font-serif border-2 border-[rgba(var(--paper-border),0.3)]"
                        style={{ background: 'rgb(var(--paper-soft))', color: 'rgb(var(--paper-ink))' }}
                    >
                        {hasAvatar ? (
                            <img
                                src={avatarUrl}
                                alt="Profile photo"
                                className="h-full w-full object-cover"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                }}
                            />
                        ) : (
                            initial
                        )}
                    </div>

                    {/* Camera overlay button */}
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white shadow-md transition-transform hover:scale-110 disabled:opacity-60"
                        aria-label="Upload profile photo"
                    >
                        {isUploading ? (
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        ) : (
                            <FiCamera size={14} />
                        )}
                    </button>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-1.5">
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="text-sm font-medium text-primary hover:underline disabled:opacity-60"
                    >
                        {hasAvatar ? 'Change photo' : 'Upload photo'}
                    </button>
                    {hasAvatar && (
                        <button
                            type="button"
                            onClick={handleRemove}
                            className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-[rgb(var(--danger))] transition-colors"
                        >
                            <FiTrash2 size={12} />
                            Remove
                        </button>
                    )}
                    <p className="text-xs text-ink-muted">JPG, PNG, or WebP. Max 5 MB.</p>
                </div>

                {/* Hidden file input */}
                <input
                    ref={fileInputRef}
                    type="file"
                    accept={ACCEPTED_TYPES}
                    onChange={handleFileSelect}
                    className="hidden"
                    aria-hidden="true"
                />
            </div>
            {error && (
                <p role="alert" className="text-xs text-[rgb(var(--danger))] ml-1">
                    {error}
                </p>
            )}
        </div>
    );
}
