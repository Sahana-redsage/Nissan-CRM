import { Router } from 'express';
import { serviceCenterController } from '../controllers/serviceCenterController';

const router = Router();

router.get('/', serviceCenterController.getAllServiceCenters);
router.get('/:id', serviceCenterController.getServiceCenterById);
router.get('/:id/appointments', serviceCenterController.getServiceCenterAppointments);

export default router;
