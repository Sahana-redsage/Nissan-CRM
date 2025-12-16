import { Router } from 'express';
import { sourceMetricsController } from '../controllers/sourceMetricsController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

// Get overall analytics
router.get('/analytics', sourceMetricsController.getAnalytics);

// Get metrics by source
router.get('/by-source', sourceMetricsController.getBySource);

// Get metrics for a specific customer
router.get('/customer/:customerId', sourceMetricsController.getByCustomer);

export default router;
