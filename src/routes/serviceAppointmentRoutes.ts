import { Router } from 'express';
import { serviceAppointmentController } from '../controllers/serviceAppointmentController';

const router = Router();
router.post('/', serviceAppointmentController.createAppointment);
router.get('/:id', serviceAppointmentController.getAppointmentById);
router.put('/:id', serviceAppointmentController.updateAppointment);
router.put('/:id/reschedule', serviceAppointmentController.rescheduleAppointment);
router.put('/:id/cancel', serviceAppointmentController.cancelAppointment);

export default router;
