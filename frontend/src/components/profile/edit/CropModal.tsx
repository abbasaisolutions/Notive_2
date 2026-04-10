'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Cropper, { Area } from 'react-easy-crop';
import { FiCheck, FiX, FiZoomIn, FiZoomOut } from 'react-icons/fi';

type CropModalProps = {
    imageUrl: string;
    onConfirm: (croppedArea: Area) => void;
    onCancel: () => void;
};

export default function CropModal({ imageUrl, onConfirm, onCancel }: CropModalProps) {
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
    const [isMounted, setIsMounted] = useState(false);

    const onCropComplete = useCallback((_: Area, croppedPixels: Area) => {
        setCroppedAreaPixels(croppedPixels);
    }, []);

    useEffect(() => {
        setIsMounted(true);

        const previousBodyOverflow = document.body.style.overflow;
        const previousHtmlOverflow = document.documentElement.style.overflow;

        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';

        return () => {
            document.body.style.overflow = previousBodyOverflow;
            document.documentElement.style.overflow = previousHtmlOverflow;
        };
    }, []);

    const handleConfirm = () => {
        if (croppedAreaPixels) {
            onConfirm(croppedAreaPixels);
        }
    };

    if (!isMounted) {
        return null;
    }

    return createPortal((
        <div className="fixed inset-0 z-[10000] bg-black/65 backdrop-blur-sm">
            <div
                className="absolute inset-0 flex items-center justify-center p-4 sm:p-6"
                onClick={onCancel}
            >
                <div
                    className="relative flex h-[min(92vh,760px)] w-[min(100%,520px)] flex-col overflow-hidden rounded-[1.8rem] shadow-2xl"
                    style={{ background: 'rgb(var(--paper-bg))' }}
                    onClick={(event) => event.stopPropagation()}
                >
                    <div className="flex items-center justify-between border-b border-[rgba(var(--paper-border),0.2)] px-4 py-3">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-[rgba(var(--paper-border),0.15)] transition-colors"
                            aria-label="Cancel"
                        >
                            <FiX size={18} />
                        </button>
                        <div className="text-center">
                            <p className="text-sm font-semibold text-ink">Crop photo</p>
                            <p className="text-[0.7rem] text-ink-muted">Move and zoom to frame it the way you want.</p>
                        </div>
                        <button
                            type="button"
                            onClick={handleConfirm}
                            className="flex h-10 min-w-[2.5rem] items-center justify-center rounded-full bg-primary px-3 text-white hover:opacity-90 transition-opacity"
                            aria-label="Apply crop"
                        >
                            <FiCheck size={18} />
                        </button>
                    </div>

                    <div className="relative flex-1 bg-black/90">
                        <Cropper
                            image={imageUrl}
                            crop={crop}
                            zoom={zoom}
                            aspect={1}
                            cropShape="round"
                            showGrid={false}
                            onCropChange={setCrop}
                            onZoomChange={setZoom}
                            onCropComplete={onCropComplete}
                            minZoom={1}
                            maxZoom={4}
                        />
                    </div>

                    <div className="border-t border-[rgba(var(--paper-border),0.2)] px-5 py-4">
                        <div className="flex items-center gap-3">
                            <FiZoomOut size={16} className="text-ink-muted shrink-0" />
                            <input
                                type="range"
                                min={1}
                                max={4}
                                step={0.05}
                                value={zoom}
                                onChange={(event) => setZoom(Number(event.target.value))}
                                className="h-1 w-full cursor-pointer appearance-none rounded-full bg-[rgba(var(--paper-border),0.3)] accent-primary"
                                aria-label="Zoom"
                            />
                            <FiZoomIn size={16} className="text-ink-muted shrink-0" />
                        </div>

                        <div className="mt-4 flex gap-3">
                            <button
                                type="button"
                                onClick={onCancel}
                                className="workspace-button-outline flex-1 rounded-xl px-4 py-3 text-sm font-semibold"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirm}
                                className="workspace-button-primary flex-1 rounded-xl px-4 py-3 text-sm font-semibold"
                            >
                                Use This Crop
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    ), document.body);
}
