import { describe, it, expect } from 'vitest';
import { inferMimeTypeFromExtension, resolveImageMimeType } from './image-upload';

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
