import { Capacitor, registerPlugin } from '@capacitor/core';

type NativeSharedFile = {
    path?: string;
    fileName?: string;
    mimeType?: string;
    size?: number;
    lastModified?: number;
};

type SharedContentPlugin = {
    consumePendingShare: () => Promise<{ files?: NativeSharedFile[] }>;
    releaseStagedFiles: (options: { paths: string[] }) => Promise<void>;
};

const SharedContent = registerPlugin<SharedContentPlugin>('SharedContent');

const inferExtension = (mimeType: string): string => {
    switch (mimeType) {
        case 'image/png':
            return '.png';
        case 'image/webp':
            return '.webp';
        case 'image/gif':
            return '.gif';
        default:
            return '.jpg';
    }
};

const normalizeFileName = (fileName: string | undefined, mimeType: string, index: number): string => {
    const trimmed = (fileName || '').trim();
    if (!trimmed) {
        return `shared-image-${index + 1}${inferExtension(mimeType)}`;
    }

    return /\.[^./\\]+$/.test(trimmed) ? trimmed : `${trimmed}${inferExtension(mimeType)}`;
};

export async function consumePendingSharedImages(): Promise<File[]> {
    if (Capacitor.getPlatform() !== 'android') {
        return [];
    }

    let nativeFiles: NativeSharedFile[] = [];

    try {
        const result = await SharedContent.consumePendingShare();
        nativeFiles = Array.isArray(result?.files) ? result.files : [];
    } catch {
        return [];
    }

    const stagedPaths = nativeFiles
        .map((file) => (typeof file.path === 'string' ? file.path : ''))
        .filter(Boolean);

    try {
        const files: File[] = [];

        for (let index = 0; index < nativeFiles.length; index += 1) {
            const nativeFile = nativeFiles[index];
            if (!nativeFile.path) {
                continue;
            }

            const response = await fetch(Capacitor.convertFileSrc(nativeFile.path));
            if (!response.ok) {
                continue;
            }

            const blob = await response.blob();
            const mimeType = (nativeFile.mimeType || blob.type || 'image/jpeg').trim() || 'image/jpeg';
            const fileName = normalizeFileName(nativeFile.fileName, mimeType, index);

            files.push(
                new File([blob], fileName, {
                    type: mimeType,
                    lastModified: typeof nativeFile.lastModified === 'number' ? nativeFile.lastModified : Date.now(),
                }),
            );
        }

        return files;
    } finally {
        if (stagedPaths.length > 0) {
            await SharedContent.releaseStagedFiles({ paths: stagedPaths }).catch(() => {});
        }
    }
}
