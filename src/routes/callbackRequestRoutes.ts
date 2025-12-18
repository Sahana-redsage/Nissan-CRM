import { Router } from 'express';
import { callbackRequestController } from '../controllers/callbackRequestController';

const router = Router();

router.post('/', callbackRequestController.createCallbackRequest);
router.get('/', callbackRequestController.getAllCallbackRequests);
router.put('/:id', callbackRequestController.updateCallbackRequestStatus);

export default router;
