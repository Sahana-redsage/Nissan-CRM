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

    // Log the entire request for debugging
    console.log("📡 Voice Webhook Hit - Full Request Body:", JSON.stringify(req.body, null, 2));
    console.log("📡 Voice Webhook Hit - Query Params:", JSON.stringify(req.query, null, 2));

    // Twilio sends form-urlencoded body
    const { From, To, CallSid } = req.body;

    // Extract customerId from query params (passed from frontend connect() call)
    let customerId = req.query.customerId ? Number(req.query.customerId) : null;

    // Clean up phone number (remove newlines, spaces, etc.)
    let toNumber = To || req.body.to || req.body.Phone || req.body.phone || req.query.To || '';
    toNumber = toNumber.toString().trim();

    console.log(`📞 Call Details:`);
    console.log(`   CallSid: ${CallSid}`);
    console.log(`   From: ${From}`);
    console.log(`   To: ${To}`);
    console.log(`   Cleaned toNumber: ${toNumber}`);

    // If customerId is missing, try to lookup customer by phone number
    if (!customerId && toNumber) {
      try {
        const digits = toNumber.replace(/\D/g, '');
        const last10 = digits.slice(-10);

        console.log(`🔍 Searching for customer with phone containing: ${last10}`);

        const customer = await prisma.customer.findFirst({
          where: {
            OR: [
              { phone: { contains: last10 } },
              { alternatePhone: { contains: last10 } }
            ]
          }
        });

        if (customer) {
          customerId = customer.id;
          console.log(`🔍 Found Customer ID ${customerId} (${customer.customerName}) via phone lookup`);
        } else {
          console.warn(`⚠️ No customer found in DB for phone: ${toNumber} (digits: ${digits})`);
        }
      } catch (lookupError) {
        console.error("❌ Error looking up customer by phone:", lookupError);
      }
    }

    console.log(`   Final CustomerId for Log: ${customerId}`);

    // Create CallLog record as soon as call starts so transcriptions have a record to update
    if (CallSid && customerId) {
      try {
        const existingLog = await prisma.callLog.findUnique({
          where: { callSid: CallSid }
        });

        if (!existingLog) {
          // Find first active telecaller or use a default
          const firstTelecaller = await prisma.telecaller.findFirst({ where: { isActive: true } });

          if (firstTelecaller) {
            await prisma.callLog.create({
              data: {
                callSid: CallSid,
                customerId: customerId,
                telecallerId: firstTelecaller.id,
                callStatus: 'ringing',
                callDate: new Date()
              }
            });
            console.log(`✅ Created initial CallLog for CallSid: ${CallSid}`);
          } else {
            console.error("❌ No active telecaller found to assign the call log.");
          }
        }
      } catch (dbError) {
        console.error("❌ Error creating initial CallLog:", dbError);
      }
    } else if (CallSid && !customerId) {
      console.warn(`⚠️ Cannot create CallLog for Sid ${CallSid}: No customerId matched.`);
    }

    // Logic: Browser (client:...) calling a Phone Number (+...)
    if (From && From.startsWith("client:")) {
      if (toNumber && toNumber.length > 5) { // Basic sanity check
        console.log(`✅ Dialing ${toNumber} with CallerId: ${config.twilioNumber}`);

        // 📝 Start Real-Time Transcription BEFORE the dial
        if (config.baseUrl && config.baseUrl.startsWith('http')) {
          const start = twiml.start();
          start.transcription({
            statusCallbackUrl: `${config.baseUrl}/api/calls/transcription-status`,
            statusCallbackMethod: 'POST',
            track: 'both_tracks', // Transcribe both caller and callee
            partialResults: false, // Only send final results
            languageCode: 'en-US',
          });
        }

        // 🔊 Dial with recording
        const dialOptions: any = {
          callerId: config.twilioNumber,
          answerOnBridge: true,
          record: 'record-from-ringing-dual',
        };

        if (config.baseUrl && config.baseUrl.startsWith('http')) {
          dialOptions.recordingStatusCallback = `${config.baseUrl}/api/calls/recording-status`;
          dialOptions.recordingStatusCallbackMethod = 'POST';

          // Also add action callback to track call completion status
          dialOptions.action = `${config.baseUrl}/api/calls/status`;
          dialOptions.method = 'POST';
        }

        const dial = twiml.dial(dialOptions);
        dial.number(toNumber);
      } else {
        console.log(`❌ No valid phone number provided. To=${toNumber}`);
        twiml.say("Sorry, no valid phone number was provided. Please try again.");
      }
    }
    else {
      // Logic: Inbound Call (Phone -> Twilio Number)
      console.log(`📞 Inbound Call from ${From} -> Forwarding to ${config.forwardToNumber}`);

      if (config.forwardToNumber) {
        // 📝 Start Real-Time Transcription BEFORE the dial
        if (config.baseUrl && config.baseUrl.startsWith('http')) {
          const start = twiml.start();
          start.transcription({
            statusCallbackUrl: `${config.baseUrl}/api/calls/transcription-status`,
            statusCallbackMethod: 'POST',
            track: 'both_tracks',
            partialResults: false,
            languageCode: 'en-US',
          });
        }

        const dial = twiml.dial({
          callerId: config.twilioNumber, // Show Twilio number as caller ID
          record: 'record-from-ringing',
          answerOnBridge: true
        });

        // Add callback for recording
        if (config.baseUrl && config.baseUrl.startsWith('http')) {
          (dial as any).recordingStatusCallback = `${config.baseUrl}/api/calls/recording-status`;
          (dial as any).recordingStatusCallbackMethod = 'POST';
        }

        dial.number(config.forwardToNumber);
      } else {
        console.warn("⚠️ FORWARD_TO_PHONE not set in .env. Falling back to voicemail.");
        twiml.say("Welcome. connecting to the agent.");
        twiml.record();
      }
    }

    const twimlString = twiml.toString();
    console.log("📤 Sending TwiML Response:", twimlString);

    // Must return text/xml
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
      console.log(customerId, callSid);
      if (customerId) {
        const logs = await prisma.callLog.findMany({
          where: { customerId: Number(customerId) },
          orderBy: { callDate: 'desc' }
        });
        console.log(logs);
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

      console.log('hi');
      let transcriptText = '';
      let callSidToUpdate = CallSid;
      let recordingSidToUpdate = req.body.RecordingSid;
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
