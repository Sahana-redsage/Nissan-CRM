import { Router } from 'express';
import { insightController } from '../controllers/insightController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

router.post('/generate', insightController.generate);
router.get('/:customerId', insightController.getByCustomerId);

export default router;
