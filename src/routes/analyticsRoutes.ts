import { Router } from 'express';
import { analyticsController } from '../controllers/analyticsController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Track link open (Public endpoint - customer clicks this)
// Defined first to avoid conflict with generic routes if any
router.get('/track/:customerId', analyticsController.trackLinkOpen as any);

// Unified Analytics Dashboard (Protected)
router.get('/', authMiddleware as any, analyticsController.getUnifiedAnalytics as any);

// Customer Engagement Details (Protected)
router.get('/engagement/:customerId', authMiddleware as any, analyticsController.getCustomerEngagement as any);

export default router;
