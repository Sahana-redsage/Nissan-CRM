import { Router } from 'express';
import { callController } from '../controllers/callController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

router.post('/log', callController.log);
router.get('/:customerId', callController.getByCustomerId);

export default router;
