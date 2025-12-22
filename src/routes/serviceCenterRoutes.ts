import { Router } from 'express';
import { serviceCenterController } from '../controllers/serviceCenterController';
import { authMiddleware } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

router.get('/', serviceCenterController.getAllServiceCenters);
router.get('/:id', serviceCenterController.getServiceCenterById);
router.get('/:id/appointments', serviceCenterController.getServiceCenterAppointments);

export default router;
