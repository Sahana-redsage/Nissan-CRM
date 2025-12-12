import { Router } from 'express';
import multer from 'multer';
import { insightController } from '../controllers/insightController';
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

router.post('/generate', insightController.generate);
router.post('/upload-and-analyze', upload.single('file'), insightController.uploadAndAnalyze);
router.get('/:customerId', insightController.getByCustomerId);

export default router;
