import { Router } from 'express';
import { serviceAppointmentController } from '../controllers/serviceAppointmentController';
import { authMiddleware } from '../middleware/auth';

const router = Router();
router.post('/', serviceAppointmentController.createAppointment);
router.put('/:id/cancel', serviceAppointmentController.cancelAppointment);
router.put('/:id/reschedule', serviceAppointmentController.rescheduleAppointment);
router.use(authMiddleware);
router.get('/pending', serviceAppointmentController.getPendingAppointments); // Must be before /:id
router.put('/:id', serviceAppointmentController.updateAppointment);
router.post('/:id/confirm', serviceAppointmentController.confirmAppointment);
router.put('/:id/status', serviceAppointmentController.updateAppointmentStatus);
router.get('/:id', serviceAppointmentController.getAppointmentById);


export default router;
