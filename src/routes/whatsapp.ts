import express from 'express';
import { whatsappController } from '../controllers/whatsappController';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

router.post('/send-insights', authMiddleware, whatsappController.sendInsightSummary);
router.post('/webhook', whatsappController.webhook); // Usually webhooks might not need auth or use signature verification
router.get('/logs/:customerId', authMiddleware, whatsappController.getLogsByCustomer);
router.get('/analytics', authMiddleware, whatsappController.getAnalytics);

export default router;