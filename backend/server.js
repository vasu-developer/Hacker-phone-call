// server/index.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { randomUUID } from "crypto";
import Twilio from "twilio";

const { AccessToken } = Twilio.jwt;
const { VoiceGrant } = AccessToken;

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Load environment variables
const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_FROM_NUMBER,
  TWILIO_API_KEY_SID,
  TWILIO_API_KEY_SECRET,
  TWILIO_TWIML_APP_SID,
  WEBHOOK_BASE_URL,
  PORT = 3000,
} = process.env;

// Validate critical env vars
if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) {
  console.error("❌ Missing Twilio environment variables.");
  console.error("Required: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER");
  process.exit(1);
}

const twClient = Twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
const E164_REGEX = /^\+[1-9]\d{7,14}$/;

// Root route
app.get("/", (req, res) => res.send("🚀 Hacker Call Backend (Twilio Connected)"));

// Simple test route
app.get("/user", (req, res) => {
  res.json({ user: "Hacker Terminal" });
});

/**
 * POST /call
 * Creates an outbound call via Twilio
 */
app.post("/call", async (req, res) => {
  const rawNumber = req.body?.number;
  const receivedAt = new Date().toISOString();

  console.log(`[${receivedAt}] ▶ /call payload`, { rawNumber });

  if (typeof rawNumber !== "string") {
    return res.status(400).json({
      success: false,
      error: "Invalid payload: number must be a string",
    });
  }

  const number = rawNumber.trim();

  // Validate E.164 format
  if (!E164_REGEX.test(number)) {
    return res.status(400).json({
      success: false,
      error: "Invalid E.164 format. Use +919876543210",
    });
  }

  try {
    // Twilio will fetch TwiML from /twiml
    const call = await twClient.calls.create({
      to: number,
      from: TWILIO_FROM_NUMBER,
      url: `${WEBHOOK_BASE_URL}/twiml?to=${encodeURIComponent(number)}`,
      statusCallback: `${WEBHOOK_BASE_URL}/twilio/status`,
      statusCallbackMethod: "POST",
      statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
    });

    console.log(`[${receivedAt}] 📞 Twilio call created sid=${call.sid}`);

    return res.json({
      success: true,
      callSid: call.sid,
    });
  } catch (err) {
    console.error(`[${receivedAt}] ❌ Twilio Call Error:`, err.message);
    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

/**
 * GET /twiml
 * Twilio fetches this to know what to do with the call.
 * This version dials the phone number forwarded in ?to=
 */
app.get("/twiml", (req, res) => {
  const number = req.query.to;

  if (!number) {
    return res.type("text/xml").send(`
      <Response>
        <Say>No number provided — cannot place call.</Say>
        <Hangup/>
      </Response>
    `);
  }

  console.log(`[TwiML] Dialing ${number}`);

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial>${number}</Dial>
</Response>`;

  res.type("application/xml").send(twiml);
});

/**
 * Twilio sends call progress events here
 */
app.post("/twilio/status", (req, res) => {
  const event = req.body;
  console.log(`[${new Date().toISOString()}] 🔄 Twilio Status Callback:`, event);
  res.sendStatus(200);
});

/**
 * GET /token
 * Provides a Twilio Access Token for WebRTC clients (browser)
 */
app.get("/token", (req, res) => {
  try {
    const identity = "hacker_" + Math.floor(Math.random() * 99999);

    const token = new AccessToken(
      TWILIO_ACCOUNT_SID,
      TWILIO_API_KEY_SID,
      TWILIO_API_KEY_SECRET,
      { identity }
    );

    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: TWILIO_TWIML_APP_SID,
      incomingAllow: false,
    });

    token.addGrant(voiceGrant);

    res.json({ token: token.toJwt(), identity });
  } catch (err) {
    console.error("Token creation error:", err);
    res.status(500).json({ error: "Failed to create token" });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`⚡ Hacker Call Server running on port ${PORT}`);
  console.log(`🌐 Webhook base: ${WEBHOOK_BASE_URL}`);
});
