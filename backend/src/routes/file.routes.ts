import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { upload, LocalFileService } from '../services/file.service';

const router = Router();

// Protected routes
router.use(authMiddleware);

// Upload generic file (image/audio)
router.post('/upload', upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const uploaded = req.file as Express.MulterFileWithLocation;
        const location = uploaded.location || uploaded.path;

        // If local, we need to construct a URL. If S3, location is already a URL.
        // Wait, current file service integration in middleware handles sending to S3 and returns details.
        // Let's check S3StorageEngine implementation in file.service.ts
        // In _handleFile: cb(null, { path: location, filename: filename })
        // So req.file.path will hold the URL if S3, or path if disk?
        // Actually, if using DiskStorage (fallback), path is absolute file path.

        // We should normalize this URL.
        // Let's us LocalFileService helper if needed.

        // Simple logic:
        let fileUrl = uploaded.path;

        // Check if it's a URL already (S3)
        if (fileUrl.startsWith('http')) {
            // S3 URL
        } else {
            // Local file, convert to URL
            fileUrl = LocalFileService.getFileUrl(req, uploaded.filename);
        }

        return res.status(201).json({
            message: 'File uploaded successfully',
            url: fileUrl,
            filename: uploaded.filename,
            mimetype: uploaded.mimetype
        });

    } catch (error) {
        console.error('Upload error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
});

export default router;
