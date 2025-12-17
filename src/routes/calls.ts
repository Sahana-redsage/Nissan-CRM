import { Router } from "express";
import { twilioController } from "../controllers/twilioController";

const router = Router();

router.get("/token", twilioController.generateToken);
router.post("/initiate", twilioController.initiateConciergeCall);
router.post("/voice", twilioController.voiceResponse);
router.post("/status", twilioController.callStatus);
router.get("/logs", twilioController.getCallLogs);

export default router;
