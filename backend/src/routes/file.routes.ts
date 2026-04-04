import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { createUpload, LocalFileService } from '../services/file.service';
import { serverLogger } from '../utils/server-logger';

const router = Router();
const imageUpload = createUpload(15 * 1024 * 1024);

// Protected routes
router.use(authMiddleware);

// Upload optimized user images with a stricter source-file cap.
router.post('/upload', imageUpload.single('file'), (req, res) => {
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
