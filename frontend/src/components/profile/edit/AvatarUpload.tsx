'use client';

import React, { useEffect, useRef, useState } from 'react';
import { FiCamera, FiTrash2 } from 'react-icons/fi';
import useApi from '@/hooks/use-api';
import {
    ACCEPTED_IMAGE_UPLOAD_TYPES_ATTR,
    MAX_IMAGE_SOURCE_BYTES,
    prepareImageForUpload,
    CropArea,
} from '@/utils/image-upload';
import CropModal from './CropModal';

type AvatarUploadProps = {
    avatarUrl: string;
    name: string;
    onAvatarChange: (url: string) => Promise<void> | void;
};

export default function AvatarUpload({ avatarUrl, name, onAvatarChange }: AvatarUploadProps) {
    const { apiFetch } = useApi();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState('');
    const [cropFile, setCropFile] = useState<File | null>(null);
    const [cropPreviewUrl, setCropPreviewUrl] = useState<string | null>(null);
    const [previewFailed, setPreviewFailed] = useState(false);

    const initial = name?.charAt(0).toUpperCase() || '?';
    const hasAvatar = avatarUrl.trim().length > 0;
    const showAvatarImage = hasAvatar && !previewFailed;

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';
        setError('');

        if (file.size > MAX_IMAGE_SOURCE_BYTES) {
            setError('Choose a profile photo under 15 MB.');
            return;
        }

        const url = URL.createObjectURL(file);
        setCropFile(file);
        setCropPreviewUrl(url);
    };

    const handleCropConfirm = async (croppedArea: CropArea) => {
        if (!cropFile) return;

        // Clean up preview URL
        if (cropPreviewUrl) URL.revokeObjectURL(cropPreviewUrl);
        setCropPreviewUrl(null);

        const file = cropFile;
        setCropFile(null);
        setIsUploading(true);

        try {
            const prepared = await prepareImageForUpload(file, 'avatar', croppedArea);
            const formData = new FormData();
            formData.append('file', prepared.file, prepared.file.name);

            const res = await apiFetch('/files/upload', {
                method: 'POST',
                body: formData,
            });

            if (!res.ok) {
                const data = await res.json().catch(() => null);
                throw new Error(data?.message || 'Upload failed');
            }

            const data = await res.json();
            await onAvatarChange(data.url);
        } catch (err: any) {
            setError(err.message || 'We couldn’t save your photo. Please try again.');
        } finally {
            setIsUploading(false);
        }
    };

    const handleCropCancel = () => {
        if (cropPreviewUrl) URL.revokeObjectURL(cropPreviewUrl);
        setCropPreviewUrl(null);
        setCropFile(null);
    };

    useEffect(() => (
        () => {
            if (cropPreviewUrl) {
                URL.revokeObjectURL(cropPreviewUrl);
            }
        }
    ), [cropPreviewUrl]);

    useEffect(() => {
        setPreviewFailed(false);
    }, [avatarUrl]);

    const handleRemove = async () => {
        setError('');
        setIsUploading(true);

        try {
            await onAvatarChange('');
        } catch (err: any) {
            setError(err.message || 'We couldn’t remove your photo. Please try again.');
        } finally {
            setIsUploading(false);
        }
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
                        {showAvatarImage ? (
                            <img
                                src={avatarUrl}
                                alt="Profile photo"
                                crossOrigin="anonymous"
                                className="h-full w-full object-cover"
                                onError={() => setPreviewFailed(true)}
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
                    <p className="text-xs text-ink-muted">JPG, PNG, or WebP. Max 15 MB, and you&apos;ll crop it before upload.</p>
                </div>

                {/* Hidden file input */}
                <input
                    ref={fileInputRef}
                    type="file"
                    accept={ACCEPTED_IMAGE_UPLOAD_TYPES_ATTR}
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

            {/* Crop modal */}
            {cropPreviewUrl && (
                <CropModal
                    imageUrl={cropPreviewUrl}
                    onConfirm={handleCropConfirm}
                    onCancel={handleCropCancel}
                />
            )}
        </div>
    );
}
