import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { upload, LocalFileService } from '../services/file.service';
import { serverLogger } from '../utils/server-logger';

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

        let fileUrl = uploaded.path;
        if (!fileUrl.startsWith('http')) {
            fileUrl = LocalFileService.getFileUrl(req, uploaded.filename);
        }

        return res.status(201).json({
            message: 'File uploaded successfully',
            url: fileUrl,
            filename: uploaded.filename,
            mimetype: uploaded.mimetype
        });

    } catch (error) {
        const errorPayload = error instanceof Error
            ? {
                message: error.message,
                stack: error.stack,
            }
            : {
                value: String(error),
            };

        serverLogger.error('files.upload_failed', {
            method: req.method,
            path: req.originalUrl || req.url,
            filename: req.file?.filename,
            mimetype: req.file?.mimetype,
            ...errorPayload,
        });
        return res.status(500).json({ message: 'Internal server error' });
    }
});

export default router;
