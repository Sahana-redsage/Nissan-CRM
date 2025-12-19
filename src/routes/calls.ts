import { Router } from "express";
import { twilioController } from "../controllers/twilioController";
import { callController } from "../controllers/callController";
import { authMiddleware } from "../middleware/auth";

const router = Router();

router.get("/token", twilioController.generateToken);
router.post("/initiate", twilioController.initiateConciergeCall);
router.post("/voice", twilioController.voiceResponse);
router.post("/status", twilioController.callStatus);
router.get("/logs", twilioController.getCallLogs);
router.get("/recordings", twilioController.getRecordings);
router.get("/recordings/:sid/play", twilioController.playRecording);
router.post("/recording-status", twilioController.recordingStatus);
router.post("/transcription-status", twilioController.transcriptionStatus);

// Manual Log
router.post("/manual-log", authMiddleware, callController.log);

export default router;
