import { Router } from 'express';
import { customerController } from '../controllers/customerController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

router.get('/due-for-service', customerController.getDueForService);
router.get('/:id', customerController.getById);

export default router;
