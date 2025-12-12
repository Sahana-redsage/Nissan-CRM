import { Router } from 'express';
import dashboardController from '../controllers/dashboardController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

router.get('/stats', dashboardController.getStats);

export default router;
