import { Router } from 'express';
import multer from 'multer';
import { documentController } from '../controllers/documentController';
import { authMiddleware } from '../middleware/auth';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
});

router.use(authMiddleware);

router.post('/upload', upload.array('files', 10), documentController.upload);
router.get('/:customerId', documentController.getByCustomerId);
router.delete('/:documentId', documentController.delete);

export default router;
