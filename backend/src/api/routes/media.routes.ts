import { Router } from 'express';
import { AuthRequest } from '../../types/user';
import { Response } from 'express';
import multer from 'multer';
import { mediaController } from '../../controllers/media';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Upload media
router.post('/upload', upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const url = await mediaController.uploadMedia(req.file, req.user?.id);
    res.json({ url });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get media by ID
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const media = await mediaController.getMedia(parseInt(req.params.id), req.user?.id);
    if (!media) {
      return res.status(404).json({ error: 'Media not found' });
    }
    res.json(media);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Delete media
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    await mediaController.deleteMedia(req.params.id, req.user?.id);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router; 