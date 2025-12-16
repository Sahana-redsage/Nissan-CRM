
import { Router } from 'express';
import { customerController } from '../controllers/customerController';

const router = Router();

router.get('/:id', customerController.getById);

export default router;
