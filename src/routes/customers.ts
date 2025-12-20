import { Router } from 'express';
import { customerController } from '../controllers/customerController';
import { serviceAppointmentController } from '../controllers/serviceAppointmentController';
import { callbackRequestController } from '../controllers/callbackRequestController';
import { authMiddleware } from '../middleware/auth';

const router = Router();
router.get('/', customerController.getAll);
router.post('/', customerController.create);
router.get('/service-analytics', customerController.getServiceAnalytics);
router.get('/:id', customerController.getById);
router.get('/:id/appointments', serviceAppointmentController.getCustomerAppointments);
router.get('/:id/callback-requests', callbackRequestController.getCustomerCallbackRequests);

export default router;
