'use client';

const ACCEPTED_IMAGE_UPLOAD_TYPES = [
    'image/jpeg',
    'image/png',
    'image/webp',
] as const;

/**
 * Use `image/*` so Android file pickers always open correctly.
 * Specific MIME-type validation still happens in `isAcceptedImageType()`.
 */
export const ACCEPTED_IMAGE_UPLOAD_TYPES_ATTR = 'image/*';
export const MAX_IMAGE_SOURCE_BYTES = 15 * 1024 * 1024; // 15 MB

type ImageUploadPreset = 'avatar' | 'entry';

export type CropArea = {
    x: number;
    y: number;
    width: number;
    height: number;
};

type PreparedImageUpload = {
    file: File;
    width: number;
    height: number;
    originalBytes: number;
    finalBytes: number;
    wasTransformed: boolean;
};

type LoadedImage = {
    image: HTMLImageElement;
    objectUrl: string;
    width: number;
    height: number;
};

type PresetConfig = {
    label: string;
    maxWidth: number;
    maxHeight: number;
    targetBytes: number;
    quality: number;
    squareCrop: boolean;
};

const PRESETS: Record<ImageUploadPreset, PresetConfig> = {
    avatar: {
        label: 'profile photo',
        maxWidth: 512,
        maxHeight: 512,
        targetBytes: 220 * 1024,
        quality: 0.82,
        squareCrop: true,
    },
    entry: {
        label: 'entry image',
        maxWidth: 1600,
        maxHeight: 1600,
        targetBytes: 1200 * 1024,
        quality: 0.8,
        squareCrop: false,
    },
};

const QUALITY_STEPS = [1, 0.9, 0.82, 0.74, 0.66, 0.58, 0.5];

const replaceExtension = (fileName: string, nextExtension: string) =>
    fileName.includes('.')
        ? fileName.replace(/\.[^.]+$/, nextExtension)
        : `${fileName}${nextExtension}`;

const extensionForMimeType = (mimeType: string) => {
    switch (mimeType) {
        case 'image/png':
            return '.png';
        case 'image/jpeg':
            return '.jpg';
        default:
            return '.webp';
    }
};

/** @internal — exported for testing */
export const inferMimeTypeFromExtension = (fileName: string): string | null => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
        case 'jpg':
        case 'jpeg':
            return 'image/jpeg';
        case 'png':
            return 'image/png';
        case 'webp':
            return 'image/webp';
        default:
            return null;
    }
};

/** @internal — exported for testing */
export const resolveImageMimeType = (file: Pick<File, 'type' | 'name'>): string | null => {
    if (ACCEPTED_IMAGE_UPLOAD_TYPES.includes(file.type as (typeof ACCEPTED_IMAGE_UPLOAD_TYPES)[number])) {
        return file.type;
    }
    // Android file pickers often return empty or generic MIME types (e.g. application/octet-stream).
    // Fall back to extension-based detection.
    return inferMimeTypeFromExtension(file.name);
};

const isAcceptedImageType = (file: File) => resolveImageMimeType(file) !== null;

const canvasToBlob = (canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> =>
    new Promise((resolve) => {
        canvas.toBlob((blob) => resolve(blob), type, quality);
    });

const loadImage = async (file: File): Promise<LoadedImage> => {
    const objectUrl = URL.createObjectURL(file);

    try {
        const image = await new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.decoding = 'async';
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('That image could not be read. Try a JPG, PNG, or WebP photo.'));
            img.src = objectUrl;
        });

        const width = image.naturalWidth || image.width;
        const height = image.naturalHeight || image.height;

        if (!width || !height) {
            throw new Error('That image could not be read. Try a different photo.');
        }

        return { image, objectUrl, width, height };
    } catch (error) {
        URL.revokeObjectURL(objectUrl);
        throw error;
    }
};

const buildCanvas = (
    loaded: LoadedImage,
    preset: PresetConfig,
    customCrop?: CropArea,
): {
    canvas: HTMLCanvasElement;
    targetWidth: number;
    targetHeight: number;
    didCrop: boolean;
    didResize: boolean;
} => {
    const { image, width: sourceWidth, height: sourceHeight } = loaded;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    if (!context) {
        throw new Error('Image processing is not available in this browser.');
    }

    let sourceX = 0;
    let sourceY = 0;
    let sourceDrawWidth = sourceWidth;
    let sourceDrawHeight = sourceHeight;
    let targetWidth = sourceWidth;
    let targetHeight = sourceHeight;
    let didCrop = false;

    if (customCrop) {
        sourceX = Math.round(customCrop.x);
        sourceY = Math.round(customCrop.y);
        sourceDrawWidth = Math.round(customCrop.width);
        sourceDrawHeight = Math.round(customCrop.height);
        targetWidth = Math.min(sourceDrawWidth, preset.maxWidth);
        targetHeight = Math.min(sourceDrawHeight, preset.maxHeight);
        didCrop = true;
    } else if (preset.squareCrop) {
        const side = Math.min(sourceWidth, sourceHeight);
        sourceX = Math.floor((sourceWidth - side) / 2);
        sourceY = Math.floor((sourceHeight - side) / 2);
        sourceDrawWidth = side;
        sourceDrawHeight = side;
        targetWidth = Math.min(side, preset.maxWidth);
        targetHeight = Math.min(side, preset.maxHeight);
        didCrop = sourceWidth !== sourceHeight;
    } else {
        const scale = Math.min(
            1,
            preset.maxWidth / sourceWidth,
            preset.maxHeight / sourceHeight,
        );

        targetWidth = Math.max(1, Math.round(sourceWidth * scale));
        targetHeight = Math.max(1, Math.round(sourceHeight * scale));
    }

    canvas.width = targetWidth;
    canvas.height = targetHeight;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(
        image,
        sourceX,
        sourceY,
        sourceDrawWidth,
        sourceDrawHeight,
        0,
        0,
        targetWidth,
        targetHeight,
    );

    return {
        canvas,
        targetWidth,
        targetHeight,
        didCrop,
        didResize: targetWidth !== sourceDrawWidth || targetHeight !== sourceDrawHeight,
    };
};

const tryEncodeFormat = async (
    canvas: HTMLCanvasElement,
    mimeType: string,
    preset: PresetConfig,
): Promise<Blob | null> => {
    let smallestBlob: Blob | null = null;

    for (const quality of QUALITY_STEPS) {
        const effectiveQuality = Math.min(quality, preset.quality);
        const blob = await canvasToBlob(canvas, mimeType, effectiveQuality);

        if (!blob) continue;

        if (!smallestBlob || blob.size < smallestBlob.size) {
            smallestBlob = blob;
        }

        if (blob.size <= preset.targetBytes) {
            return blob;
        }
    }

    return smallestBlob;
};

const encodeOptimizedImage = async (
    canvas: HTMLCanvasElement,
    preset: PresetConfig,
): Promise<Blob> => {
    // Try WebP first, then fall back to JPEG.
    // Some Android WebViews do not support WebP encoding via canvas.toBlob.
    const webpResult = await tryEncodeFormat(canvas, 'image/webp', preset);
    if (webpResult) return webpResult;

    const jpegResult = await tryEncodeFormat(canvas, 'image/jpeg', preset);
    if (jpegResult) return jpegResult;

    throw new Error(`We could not optimize that ${preset.label}. Please try a different image.`);
};

export const prepareImageForUpload = async (
    file: File,
    presetKey: ImageUploadPreset,
    customCrop?: CropArea,
): Promise<PreparedImageUpload> => {
    const preset = PRESETS[presetKey];

    if (!isAcceptedImageType(file)) {
        throw new Error(`Use a JPG, PNG, or WebP ${preset.label}.`);
    }

    if (file.size > MAX_IMAGE_SOURCE_BYTES) {
        throw new Error(`Choose a ${preset.label} under 15 MB. We will shrink it before upload.`);
    }

    const loaded = await loadImage(file);

    try {
        const { canvas, targetWidth, targetHeight, didCrop, didResize } = buildCanvas(loaded, preset, customCrop);
        const optimizedBlob = await encodeOptimizedImage(canvas, preset);
        const optimizedMimeType = optimizedBlob.type || 'image/webp';
        const optimizedFile = new File([optimizedBlob], replaceExtension(file.name, extensionForMimeType(optimizedMimeType)), {
            type: optimizedMimeType,
            lastModified: Date.now(),
        });

        const shouldKeepOriginal =
            !didCrop
            && !didResize
            && optimizedFile.size >= file.size;

        let finalFile: File;
        if (shouldKeepOriginal) {
            // On Android, file pickers can return a wrong MIME type (e.g. application/octet-stream).
            // Re-wrap the file with the correct type so the backend upload filter accepts it.
            const resolvedType = resolveImageMimeType(file);
            if (resolvedType && resolvedType !== file.type) {
                finalFile = new File([file], file.name, { type: resolvedType, lastModified: file.lastModified });
            } else {
                finalFile = file;
            }
        } else {
            finalFile = optimizedFile;
        }

        return {
            file: finalFile,
            width: targetWidth,
            height: targetHeight,
            originalBytes: file.size,
            finalBytes: finalFile.size,
            wasTransformed: !shouldKeepOriginal,
        };
    } finally {
        URL.revokeObjectURL(loaded.objectUrl);
    }
};
