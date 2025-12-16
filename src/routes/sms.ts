import express from 'express';
import { smsController } from '../controllers/smsController';
import { authMiddleware } from '../middleware/auth';
 
const router = express.Router();
 
router.post('/send-insight', authMiddleware, smsController.sendInsightSummary);
router.post('/webhook', smsController.webhook);
router.get('/logs/:customerId', authMiddleware, smsController.getLogsByCustomer);
router.get('/analytics', authMiddleware, smsController.getAnalytics);
 
export default router;