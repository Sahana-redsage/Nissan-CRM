import { Request, Response } from "express";
import twilio from "twilio";
import https from "https";
import prisma from "../config/database";
import { llmService } from "../services/llmService";

// Twilio configuration
const config = {
  accountSid: process.env.TWILIO_ACCOUNT_SID!,
  apiKey: process.env.TWILIO_API_KEY!,
  apiSecret: process.env.TWILIO_API_SECRET!,
  twilioNumber: process.env.TWILIO_PHONE_NUMBER!,
  twimlAppSid: process.env.TWILIO_TWIML_APP_SID,
  baseUrl: process.env.BASE_URL!,
  forwardToNumber: process.env.FORWARD_TO_PHONE
};

export const twilioController = {
  // ======================================================
  // 1️⃣ Generate Token (for Browser SDK)
  // ======================================================
  generateToken: (req: Request, res: Response) => {
    try {
      const identity = (req.query.identity as string) || "user_" + Math.floor(Math.random() * 1000);

      const AccessToken = twilio.jwt.AccessToken;
      const VoiceGrant = AccessToken.VoiceGrant;

      // Create Voice Grant
      const voiceGrant = new VoiceGrant({
        outgoingApplicationSid: config.twimlAppSid, // Required for outbound calls from browser
        incomingAllow: true // Allow incoming calls to this identity
      });

      const token = new AccessToken(
        config.accountSid,
        config.apiKey,
        config.apiSecret,
        { identity }
      );

      token.addGrant(voiceGrant);

      console.log(`✅ Generated Token for identity: ${identity}`);

      res.json({
        token: token.toJwt(),
        identity
      });
    } catch (err: any) {
      console.error("❌ Token Generation Error:", err);
      res.status(500).json({ error: err.message });
    }
  },

  // ======================================================
  // 2️⃣ Voice Webhook (TwiML) - Handle Outbound Connection
  // ======================================================
  voiceResponse: async (req: Request, res: Response) => {
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const twiml = new VoiceResponse();

    console.log("📡 Voice Webhook Hit - Body:", JSON.stringify(req.body, null, 2));
    console.log("📡 Voice Webhook Hit - Query:", JSON.stringify(req.query, null, 2));

    // Twilio sends application/x-www-form-urlencoded
    const { From, To, CallSid } = req.body;

    // 🔐 ONLY trust explicit customerId from frontend
    const customerId = req.query.customerId
      ? Number(req.query.customerId)
      : null;
    console.log('customer id== ', customerId);
    // Normalize To number
    let toNumber = To || req.body.to || req.query.To || '';
    toNumber = toNumber.toString().trim();

    console.log(`📞 Call Details`);
    console.log(`   CallSid   : ${CallSid}`);
    console.log(`   From      : ${From}`);
    console.log(`   To        : ${toNumber}`);
    console.log(`   customerId: ${customerId ?? 'NOT PROVIDED'}`);

    // ======================================================
    // 🗃️ Create CallLog ONLY if customerId is provided
    // ======================================================
    if (CallSid && customerId) {
      try {
        const existingLog = await prisma.callLog.findUnique({
          where: { callSid: CallSid }
        });

        if (!existingLog) {
          const telecaller = await prisma.telecaller.findFirst({
            where: { isActive: true }
          });

          if (!telecaller) {
            console.error("❌ No active telecaller found");
          } else {
            await prisma.callLog.create({
              data: {
                callSid: CallSid,
                customerId: customerId,
                telecallerId: telecaller.id,
                callStatus: 'ringing',
                callDate: new Date()
              }
            });
            console.log(`✅ CallLog created → CallSid=${CallSid}, customerId=${customerId}`);
          }
        }
      } catch (dbError) {
        console.error("❌ Error creating CallLog:", dbError);
      }
    } else if (!customerId) {
      console.warn(`⚠️ customerId missing — CallSid ${CallSid} will not be mapped`);
    }

    // ======================================================
    // 🌐 OUTBOUND CALL (Browser → Phone)
    // ======================================================
    if (From && From.startsWith("client:")) {
      if (!toNumber || toNumber.length < 6) {
        twiml.say("Invalid phone number. Please try again.");
      } else {
        console.log(`📤 Outbound call → ${toNumber}`);

        // 📝 Start real-time transcription BEFORE dial
        if (config.baseUrl?.startsWith("http")) {
          const start = twiml.start();
          start.transcription({
            statusCallbackUrl: `${config.baseUrl}/api/calls/transcription-status`,
            statusCallbackMethod: "POST",
            track: "both_tracks",
            partialResults: false,
            languageCode: "en-US"
          });
        }

        const dial = twiml.dial({
          callerId: config.twilioNumber,
          answerOnBridge: true,
          record: "record-from-ringing-dual",
          recordingStatusCallback: config.baseUrl
            ? `${config.baseUrl}/api/calls/recording-status`
            : undefined,
          recordingStatusCallbackMethod: "POST",
          action: config.baseUrl
            ? `${config.baseUrl}/api/calls/status`
            : undefined,
          method: "POST"
        });

        dial.number(toNumber);
      }
    }

    // ======================================================
    // 📥 INBOUND CALL (Phone → Twilio Number)
    // ======================================================
    else {
      console.log(`📥 Inbound call from ${From}`);

      if (config.forwardToNumber) {

        // 📝 Start transcription
        if (config.baseUrl?.startsWith("http")) {
          const start = twiml.start();
          start.transcription({
            statusCallbackUrl: `${config.baseUrl}/api/calls/transcription-status`,
            statusCallbackMethod: "POST",
            track: "both_tracks",
            partialResults: false,
            languageCode: "en-US"
          });
        }

        const dial = twiml.dial({
          callerId: config.twilioNumber,
          record: "record-from-ringing",
          answerOnBridge: true,
          recordingStatusCallback: config.baseUrl
            ? `${config.baseUrl}/api/calls/recording-status`
            : undefined,
          recordingStatusCallbackMethod: "POST"
        });

        dial.number(config.forwardToNumber);
      } else {
        console.warn("⚠️ FORWARD_TO_PHONE not set");
        twiml.say("Thank you for calling. Please leave a message.");
        twiml.record();
      }
    }

    // ======================================================
    // 📤 Respond TwiML
    // ======================================================
    const twimlString = twiml.toString();
    console.log("📤 Sending TwiML:", twimlString);

    res.type("text/xml");
    res.send(twimlString);
  },


  // ======================================================
  // 4️⃣ Get Call Logs from Twilio
  // ======================================================
  getCallLogs: async (req: Request, res: Response) => {
    try {
      const client = twilio(
        config.accountSid,
        process.env.TWILIO_AUTH_TOKEN // use Auth Token for REST reads
      );

      // Optional query params
      const { limit = 20 } = req.query;

      const calls = await client.calls.list({
        limit: Number(limit)
      });

      const logs = calls.map(call => ({
        callSid: call.sid,
        from: call.from,
        to: call.to,
        status: call.status,
        direction: call.direction,
        duration: call.duration,
        startTime: call.startTime,
        endTime: call.endTime,
        price: call.price,
        priceUnit: call.priceUnit
      }));

      res.status(200).json({
        success: true,
        data: logs
      });
    } catch (error: any) {
      console.error("❌ Error fetching call logs:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch call logs",
        error: error.message
      });
    }
  },

  // ======================================================
  // 5️⃣ Get Recordings from Twilio
  // ======================================================
  getRecordings: async (req: Request, res: Response) => {
    try {
      const { customerId, callSid } = req.query;

      if (customerId) {
        const logs = await prisma.callLog.findMany({
          where: { customerId: Number(customerId) },
          orderBy: { callDate: 'desc' }
        });

        const data = logs.map(log => ({
          sid: log.recordingSid,
          callSid: log.callSid,
          duration: log.callDuration,
          status: log.callStatus,
          dateCreated: log.callDate,
          url: log.recordingSid ? `/api/calls/recordings/${log.recordingSid}/play` : null,
          recordingUrl: log.recordingSid ? `/api/calls/recordings/${log.recordingSid}/play` : null,
          transcript: log.transcript,
          sentimentAnalysis: (log as any).sentimentAnalysis,
          sentimentScore: (log as any).sentimentScore
        }));

        return res.status(200).json({ success: true, data });
      }

      const client = twilio(config.accountSid, process.env.TWILIO_AUTH_TOKEN);

      let recordings;
      if (callSid) {
        recordings = await client.recordings.list({ callSid: callSid as string });
      } else {
        recordings = await client.recordings.list({ limit: 20 });
      }

      const data = recordings.map(rec => ({
        sid: rec.sid,
        callSid: rec.callSid,
        duration: rec.duration,
        status: rec.status,
        dateCreated: rec.dateCreated,
        url: `/api/calls/recordings/${rec.sid}/play`
      }));

      res.status(200).json({ success: true, data });
    } catch (error: any) {
      console.error("❌ Error fetching recordings:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },



  // ======================================================
  // 7️⃣ Play/Stream Recording Proxy
  // ======================================================
  playRecording: async (req: Request, res: Response) => {
    try {
      const { sid } = req.params;
      const accountSid = config.accountSid;
      const authToken = process.env.TWILIO_AUTH_TOKEN;

      if (!authToken) {
        throw new Error("TWILIO_AUTH_TOKEN is not set in environment variables");
      }

      console.log(`🔊 Proxying recording stream for SID: ${sid}`);

      const mp3Url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Recordings/${sid}.mp3`;
      const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

      https.get(mp3Url, {
        headers: {
          'Authorization': `Basic ${auth}`
        }
      }, (twilioRes) => {
        if (twilioRes.statusCode === 200) {
          // Forward correct content type
          res.setHeader('Content-Type', 'audio/mpeg');
          // Stream the data directly to the client
          twilioRes.pipe(res);
        } else {
          console.error(`❌ Twilio returned ${twilioRes.statusCode} for recording ${sid}`);
          res.status(twilioRes.statusCode || 404).send("Recording file not accessible on Twilio");
        }
      }).on('error', (err) => {
        console.error("❌ Error streaming from Twilio:", err);
        res.status(500).send("Internal server error during playback");
      });

    } catch (error: any) {
      console.error("❌ Error playing recording:", error);
      res.status(404).send("Recording not found");
    }
  },

  // ======================================================
  // 6️⃣ Recording Status Callback
  // ======================================================
  recordingStatus: async (req: Request, res: Response) => {
    try {
      const { RecordingUrl, RecordingSid, CallSid } = req.body;
      console.log(`⏺️ Recording Ready: CallSid=${CallSid}, URL=${RecordingUrl}`);

      // 1. Update DB with Recording URL
      const callLog = await prisma.callLog.findFirst({
        where: { callSid: CallSid }
      });

      if (callLog) {
        await prisma.callLog.update({
          where: { id: callLog.id },
          data: {
            recordingSid: RecordingSid,
            recordingUrl: RecordingUrl
          }
        });
        console.log(`✅ Updated CallLog ${callLog.id} with recording URL`);
      }

      // NOTE: We don't need to trigger a second transcription here because 
      // the <Start><Transcription> in voiceResponse is already capturing real-time dual-track transcripts.

      res.sendStatus(200);
    } catch (error) {
      console.error("❌ Error in recordingStatus:", error);
      res.sendStatus(500);
    }
  },

  // ======================================================
  // 8️⃣ Transcription Status Callback (Real-Time & Legacy)
  // ======================================================
  transcriptionStatus: async (req: Request, res: Response) => {
    try {
      console.log(`📝 Transcription Callback received:`, JSON.stringify(req.body, null, 2));

      // Real-time transcription format
      const {
        CallSid,
        TranscriptionEvent,
        TranscriptionData,
        TranscriptionText,      // Legacy format
        TranscriptionStatus,    // Legacy format
        Track                   // Track info: inbound_track (agent) vs outbound_track (customer)
      } = req.body;

      let transcriptText = '';
      let callSidToUpdate = CallSid;

      // Handle real-time transcription events
      if (TranscriptionEvent === 'transcription-content') {
        let rawText = '';
        try {
          if (TranscriptionData && typeof TranscriptionData === 'string' && TranscriptionData.startsWith('{')) {
            const parsed = JSON.parse(TranscriptionData);
            rawText = parsed.transcript || '';
          } else {
            rawText = TranscriptionData || '';
          }
        } catch (e) {
          console.warn("⚠️ Failed to parse TranscriptionData as JSON, using raw data:", e);
          rawText = TranscriptionData || '';
        }

        if (rawText.trim()) {
          // Label the speaker based on the track
          const label = (Track === 'inbound_track') ? 'Agent' : 'Customer';
          transcriptText = `[${label}]: ${rawText.trim()}`;
        }

        console.log(`📝 Real-time transcript (${Track}): "${transcriptText}"`);
      }
      // Handle legacy transcription format
      else if (TranscriptionStatus === 'completed' && TranscriptionText) {
        transcriptText = `[Call Summary]: ${TranscriptionText}`;
        console.log(`📝 Legacy transcript: "${transcriptText}"`);
      }

      // Update the call log with transcript
      if (transcriptText && callSidToUpdate) {
        const callLog = await prisma.callLog.findFirst({
          where: { callSid: callSidToUpdate }
        });

        if (callLog) {
          // Append to existing transcript (for real-time, we may get multiple updates)
          const existingTranscript = callLog.transcript || '';
          const newTranscript = existingTranscript
            ? `${existingTranscript}\n${transcriptText}`
            : transcriptText;

          await prisma.callLog.update({
            where: { id: callLog.id },
            data: { transcript: newTranscript }
          });
          console.log(`✅ Updated CallLog ${callLog.id} with transcript`);

          // Perform Sentiment Analysis
          try {
            console.log(`🧠 Generating Sentiment Analysis for CallLog ${callLog.id}...`);
            const analysis = await llmService.generateSentimentAnalysis(newTranscript);
            await prisma.callLog.update({
              where: { id: callLog.id },
              data: {
                sentimentAnalysis: analysis.sentiment,
                sentimentScore: analysis.score
              } as any
            });
            console.log(`✅ Updated CallLog ${callLog.id} with sentiment analysis: ${analysis.sentiment}`);
          } catch (sentimentError) {
            console.error(`❌ Failed to generate sentiment analysis for CallLog ${callLog.id}:`, sentimentError);
          }
        } else {
          console.warn(`⚠️ No CallLog found for CallSid: ${callSidToUpdate}`);
        }
      }

      res.sendStatus(200);
    } catch (error) {
      console.error("❌ Error in transcriptionStatus:", error);
      res.sendStatus(500);
    }
  },

  callStatus: async (req: Request, res: Response) => {
    const { CallSid, CallStatus, CallDuration } = req.body;
    console.log(`📊 Call Status: Sid=${CallSid}, Status=${CallStatus}, Duration=${CallDuration}`);

    try {
      if (CallSid) {
        await prisma.callLog.update({
          where: { callSid: CallSid },
          data: {
            callStatus: CallStatus || 'completed',
            callDuration: CallDuration ? Number(CallDuration) : undefined
          }
        });
        console.log(`✅ Updated CallLog ${CallSid} status to ${CallStatus}`);
      }
    } catch (dbError) {
      console.error(`❌ Error updating call status for ${CallSid}:`, dbError);
    }

    // Always return 200 OK with empty TwiML
    res.type("text/xml");
    res.send("<Response></Response>");
  },

  // Stub for existing route if any
  initiateConciergeCall: (req: Request, res: Response) => {
    res.status(501).json({ message: "Not implemented. Use client-side initiation." });
  }
};


