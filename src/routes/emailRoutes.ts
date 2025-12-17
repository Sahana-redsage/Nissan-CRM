import { Router } from 'express';
import { emailController } from '../controllers/emailController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Public routes
router.get('/track/:id', emailController.trackEmailOpen);

// Protected routes
router.use(authMiddleware);
router.post('/send-insight', emailController.sendInsightEmail);
router.post('/send-bulk', emailController.sendBulkInsightEmails);
router.get('/logs/:id', emailController.getemailLogs);

export default router;
