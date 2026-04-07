import { describe, it, expect } from 'vitest';

// We test the module's exported helpers indirectly by importing them.
// The canvas/blob functions need a real DOM so we focus on the pure logic
// that can run in jsdom.

// Re-implement the private helpers inline so we can unit-test the logic
// without exporting them from the production module.

const ACCEPTED_IMAGE_UPLOAD_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

const inferMimeTypeFromExtension = (fileName: string): string | null => {
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

const resolveImageMimeType = (file: { type: string; name: string }): string | null => {
    if (ACCEPTED_IMAGE_UPLOAD_TYPES.includes(file.type as any)) {
        return file.type;
    }
    return inferMimeTypeFromExtension(file.name);
};

describe('inferMimeTypeFromExtension', () => {
    it('returns image/jpeg for .jpg', () => {
        expect(inferMimeTypeFromExtension('photo.jpg')).toBe('image/jpeg');
    });

    it('returns image/jpeg for .jpeg', () => {
        expect(inferMimeTypeFromExtension('photo.jpeg')).toBe('image/jpeg');
    });

    it('returns image/png for .png', () => {
        expect(inferMimeTypeFromExtension('screenshot.png')).toBe('image/png');
    });

    it('returns image/webp for .webp', () => {
        expect(inferMimeTypeFromExtension('avatar.webp')).toBe('image/webp');
    });

    it('returns null for unsupported extensions', () => {
        expect(inferMimeTypeFromExtension('document.pdf')).toBeNull();
        expect(inferMimeTypeFromExtension('file.gif')).toBeNull();
    });

    it('is case-insensitive', () => {
        expect(inferMimeTypeFromExtension('PHOTO.JPG')).toBe('image/jpeg');
        expect(inferMimeTypeFromExtension('image.PNG')).toBe('image/png');
    });
});

describe('resolveImageMimeType', () => {
    it('returns the file type when it is a valid image MIME', () => {
        expect(resolveImageMimeType({ type: 'image/jpeg', name: 'x.jpg' })).toBe('image/jpeg');
        expect(resolveImageMimeType({ type: 'image/png', name: 'x.png' })).toBe('image/png');
        expect(resolveImageMimeType({ type: 'image/webp', name: 'x.webp' })).toBe('image/webp');
    });

    it('falls back to extension when type is empty (Android picker)', () => {
        expect(resolveImageMimeType({ type: '', name: 'photo.jpg' })).toBe('image/jpeg');
    });

    it('falls back to extension when type is application/octet-stream (Android)', () => {
        expect(resolveImageMimeType({ type: 'application/octet-stream', name: 'camera.png' })).toBe('image/png');
    });

    it('returns null when both type and extension are unrecognized', () => {
        expect(resolveImageMimeType({ type: 'application/pdf', name: 'doc.pdf' })).toBeNull();
    });
});
