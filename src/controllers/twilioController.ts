import { Request, Response } from "express";
import twilio from "twilio";

// Twilio configuration
const config = {
  accountSid: process.env.TWILIO_ACCOUNT_SID!,
  apiKey: process.env.TWILIO_API_KEY!,
  apiSecret: process.env.TWILIO_API_SECRET!,
  twilioNumber: process.env.TWILIO_PHONE_NUMBER!,
  twimlAppSid: process.env.TWILIO_TWIML_APP_SID,
  baseUrl: process.env.BASE_URL!
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
  voiceResponse: (req: Request, res: Response) => {
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const twiml = new VoiceResponse();

    // Log the entire request for debugging
    console.log("📡 Voice Webhook Hit - Full Request Body:", JSON.stringify(req.body, null, 2));
    console.log("📡 Voice Webhook Hit - Query Params:", JSON.stringify(req.query, null, 2));

    // Twilio sends form-urlencoded body
    const { From, To, CallSid } = req.body;

    // Also check for common alternative parameter names
    const toNumber = To || req.body.to || req.body.Phone || req.body.phone || req.query.To;

    console.log(`📞 Call Details:`);
    console.log(`   CallSid: ${CallSid}`);
    console.log(`   From: ${From}`);
    console.log(`   To: ${To}`);
    console.log(`   Resolved toNumber: ${toNumber}`);

    // Logic: Browser (client:...) calling a Phone Number (+...)
    if (From && From.startsWith("client:")) {
      if (toNumber && toNumber.startsWith("+")) {
        console.log(`✅ Dialing ${toNumber} with CallerId: ${config.twilioNumber}`);

        // 🔊 Verification: If you hear this, our code is working!
        twiml.say("Connecting call. Recording started.");

        const dial = twiml.dial({
          callerId: config.twilioNumber,
          answerOnBridge: true,
          record: 'record-from-ringing-dual', // ⏺️ Stronger recording trigger
          trim: 'trim-silence'
        });

        // Add callback only if baseUrl is valid
        if (config.baseUrl && config.baseUrl.startsWith('http')) {
          (dial as any).recordingStatusCallback = `${config.baseUrl}/api/calls/recording-status`;
          (dial as any).recordingStatusCallbackMethod = 'POST';
        }
        dial.number(toNumber);
      } else {
        console.log(`❌ No valid phone number provided. To=${toNumber}`);
        twiml.say("Sorry, no valid phone number was provided. Please try again.");
      }
    }
    else {
      console.log("⚠️ Not a client call or unknown call flow.");
      twiml.say("Welcome. This is a test call.");
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
      const client = twilio(config.accountSid, process.env.TWILIO_AUTH_TOKEN);
      const { callSid } = req.query;

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
      const client = twilio(config.accountSid, process.env.TWILIO_AUTH_TOKEN);

      const recording = await client.recordings(sid).fetch();

      // Redirect to the Twilio MP3 URL
      const mp3Url = `https://api.twilio.com2010-04-01/Accounts/${config.accountSid}/Recordings/${sid}.mp3`;
      res.redirect(mp3Url);
    } catch (error: any) {
      console.error("❌ Error playing recording:", error);
      res.status(404).send("Recording not found");
    }
  },

  // ======================================================
  // 6️⃣ Recording Status Callback
  // ======================================================
  recordingStatus: (req: Request, res: Response) => {
    const { RecordingUrl, RecordingSid, CallSid } = req.body;
    console.log(`⏺️ Recording Ready: CallSid=${CallSid}, URL=${RecordingUrl}`);
    res.sendStatus(200);
  },

  // ======================================================
  // 3️⃣ Call Status Callback
  // ======================================================
  callStatus: (req: Request, res: Response) => {
    const { CallSid, CallStatus } = req.body;
    console.log(`📊 Call Status: Sid=${CallSid}, Status=${CallStatus}`);

    // Always return 200 OK with empty TwiML
    res.type("text/xml");
    res.send("<Response></Response>");
  },

  // Stub for existing route if any
  initiateConciergeCall: (req: Request, res: Response) => {
    res.status(501).json({ message: "Not implemented. Use client-side initiation." });
  }
};
