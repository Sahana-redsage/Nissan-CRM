import { Router } from 'express';
import { callbackRequestController } from '../controllers/callbackRequestController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

router.post('/', callbackRequestController.createCallbackRequest);
router.get('/', callbackRequestController.getAllCallbackRequests);
router.put('/:id', callbackRequestController.updateCallbackRequestStatus);

export default router;
