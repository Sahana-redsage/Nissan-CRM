import { Router } from 'express';
import { serviceAppointmentController } from '../controllers/serviceAppointmentController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

router.post('/', serviceAppointmentController.createAppointment);
router.get('/:id', serviceAppointmentController.getAppointmentById);
router.put('/:id', serviceAppointmentController.updateAppointment);
router.put('/:id/reschedule', serviceAppointmentController.rescheduleAppointment);
router.put('/:id/cancel', serviceAppointmentController.cancelAppointment);
// Note: getCustomerAppointments is strictly defined as /api/customers/{customer_id}/appointments in the user request.
// So I should probably place that route in a customer-related route file or handle it here if the path allows.
// Usually /api/customers is handled by customerRoutes.
// I will add the customer appointments route to `customerRoutes` instead or keeping strictly to the plan "ServiceAppointments route file".
// Wait, the user listed endpoints.
// GET /api/customers/{customer_id}/appointments
// This should technically be in customerRoutes, but I can export the controller function and use it there.
// For now, I'll add the service appointment routes here.

export default router;
