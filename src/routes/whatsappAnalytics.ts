import { Router } from 'express';
import { whatsappAnalyticsController } from '../controllers/whatsappAnalyticsController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

router.get('/summary', whatsappAnalyticsController.getSummary);
router.get('/by-telecaller', whatsappAnalyticsController.getByTelecaller);
router.get('/by-customer', whatsappAnalyticsController.getByCustomer);
router.get('/timeseries', whatsappAnalyticsController.getTimeseries);

export default router;
