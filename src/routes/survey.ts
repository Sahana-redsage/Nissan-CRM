import { Router } from 'express';
import { surveyController } from '../controllers/surveyController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Public endpoint - no authentication required
router.post('/submit', surveyController.submitSurvey);

// Protected endpoints - require authentication
router.get('/analytics', authMiddleware, surveyController.getAnalytics);
router.get('/intent-analysis', authMiddleware, surveyController.getIntentAnalysis);
router.get('/advanced-analytics', authMiddleware, surveyController.getAdvancedAnalytics);

export default router;
