import { Router } from 'express';
import { serviceCenterController } from '../controllers/serviceCenterController';
// Assuming authMiddleware is needed, checking imports in other files, usually 'authenticate' or similar inside middleware/auth
// The controller used 'AuthRequest' so it implies authentication is middleware.
// Let's check how other routes import it.
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

router.get('/', serviceCenterController.getAllServiceCenters);
router.get('/:id', serviceCenterController.getServiceCenterById);
router.get('/:id/appointments', serviceCenterController.getServiceCenterAppointments);

export default router;
