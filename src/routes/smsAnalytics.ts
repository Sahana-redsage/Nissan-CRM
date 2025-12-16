import { Router } from 'express';
import { smsAnalyticsController } from '../controllers/smsAnalyticsController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

router.get('/summary', smsAnalyticsController.getSummary);
router.get('/by-telecaller', smsAnalyticsController.getByTelecaller);
router.get('/by-customer', smsAnalyticsController.getByCustomer);
router.get('/timeseries', smsAnalyticsController.getTimeseries);

export default router;
