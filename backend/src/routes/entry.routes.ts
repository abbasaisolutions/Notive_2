import { Router } from 'express';
import {
    createEntry,
    getEntries,
    getEntry,
    updateEntry,
    deleteEntry,
} from '../controllers/entry.controller';
import searchController from '../controllers/search.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { upload, LocalFileService } from '../services/file.service';

const router = Router();

// All routes are protected
router.use(authMiddleware);

// Upload endpoint
router.post('/upload', upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }
    const url = (req.file as any).path.startsWith('http')
        ? (req.file as any).path
        : LocalFileService.getFileUrl(req, req.file.filename);
    res.json({ url });
});

// Search routes (must be before /:id to avoid conflicts)
router.get('/search', searchController.searchEntries);
router.get('/search/suggestions', searchController.getSearchSuggestions);

router.post('/', createEntry);
router.get('/', getEntries);
router.get('/:id', getEntry);
router.put('/:id', updateEntry);
router.delete('/:id', deleteEntry);

export default router;
