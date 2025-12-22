import { Router } from 'express';
import { customerController } from '../controllers/customerController';
import { serviceAppointmentController } from '../controllers/serviceAppointmentController';
import { callbackRequestController } from '../controllers/callbackRequestController';
import { authMiddleware } from '../middleware/auth';

const router = Router();
router.get('/service-analytics', customerController.getServiceAnalytics);
router.get('/:id/appointments', serviceAppointmentController.getCustomerAppointments);
router.get('/:id/callback-requests', callbackRequestController.getCustomerCallbackRequests);
// Protect all routes
router.use(authMiddleware);

router.get('/', customerController.getAll);
router.post('/', customerController.create);
router.get('/:id', customerController.getById);
router.put('/:id', customerController.update);


export default router;
