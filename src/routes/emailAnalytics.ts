import { Router } from 'express';
import { emailAnalyticsController } from '../controllers/emailAnalyticsController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

router.get('/summary', emailAnalyticsController.getSummary);
router.get('/by-telecaller', emailAnalyticsController.getByTelecaller);
router.get('/by-customer', emailAnalyticsController.getByCustomer);
router.get('/timeseries', emailAnalyticsController.getTimeseries);

export default router;
