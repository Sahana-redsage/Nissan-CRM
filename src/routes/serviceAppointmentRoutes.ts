import { Router } from 'express';
import { serviceAppointmentController } from '../controllers/serviceAppointmentController';
import { authMiddleware } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);
router.post('/', serviceAppointmentController.createAppointment);
router.get('/', serviceAppointmentController.getAllAppointments);
router.get('/pending', serviceAppointmentController.getPendingAppointments); // Must be before /:id
router.get('/:id', serviceAppointmentController.getAppointmentById);
router.put('/:id', serviceAppointmentController.updateAppointment);
router.post('/:id/confirm', serviceAppointmentController.confirmAppointment);
router.put('/:id/status', serviceAppointmentController.updateAppointmentStatus);
router.put('/:id/reschedule', serviceAppointmentController.rescheduleAppointment);
router.put('/:id/cancel', serviceAppointmentController.cancelAppointment);

export default router;
