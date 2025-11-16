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

const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_FROM_NUMBER,
  PORT = 3000,
  WEBHOOK_BASE_URL
} = process.env;

if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) {
  console.error("Missing Twilio env vars. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER");
  process.exit(1);
}

const twClient = Twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
const E164_REGEX = /^\+[1-9]\d{7,14}$/;

app.get("/", (req, res) => res.send("🚀 Hacker Call Backend (Twilio)"));

app.get("/user" , (req, res) => {
  res.json({ user: "Hacker Terminal" });
  res.send();
  res.end();
})
/**
 * POST /call
 * body: { number: "+919876543210" }
 */
app.post("/call", async (req, res) => {
  const rawNumber = req.body?.number;
  const receivedAt = new Date().toISOString();

  console.log(`[${receivedAt}] ▶ /call payload`, { rawNumber });

  if (typeof rawNumber !== "string") {
    return res.status(400).json({ success: false, error: "Invalid payload: number must be a string" });
  }

  const number = rawNumber.trim();
  if (!E164_REGEX.test(number)) {
    return res.status(400).json({ success: false, error: "Invalid phone number format. Use E.164 like +919876543210" });
  }

  const callId = randomUUID();

  try {
    // Twilio will fetch TwiML from the `twiml` endpoint we expose below (or you can provide `twiml` inline)
    // Provide a statusCallback so Twilio notifies us of call progress
    const statusCallback = WEBHOOK_BASE_URL ? `${WEBHOOK_BASE_URL}/twilio/status` : null;

    const call = await twClient.calls.create({
      url: `${WEBHOOK_BASE_URL || ""}/twiml?callId=${callId}`, // Twilio will GET this URL to get TwiML instructions
      to: number,
      from: TWILIO_FROM_NUMBER,
      statusCallback: statusCallback || undefined,
      statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
      statusCallbackMethod: "POST"
    });

    console.log(`[${receivedAt}] 📞 Twilio call created: sid=${call.sid} to=${number}`);
    return res.json({ success: true, callId, callSid: call.sid });
  } catch (err) {
    console.error(`[${receivedAt}] ❌ Twilio error:`, err?.message || err);
    return res.status(500).json({ success: false, error: "Failed to create call", details: err?.message });
  }
});

app.get("/token", (req, res) => {
  try {
    const token = new AccessToken(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_API_KEY_SID,
      process.env.TWILIO_API_KEY_SECRET,
      { identity: "hacker_terminal_" + Math.floor(Math.random() * 9999) }
    );

    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: process.env.TWILIO_TWIML_APP_SID,
      incomingAllow: false
    });

    token.addGrant(voiceGrant);
    res.json({ token: token.toJwt() });
  } catch (err) {
    console.error("Token error:", err);
    res.status(500).json({ error: "Failed to create token" });
  }
});
/**
 * TwiML endpoint - Twilio will request this to get instructions when the call is answered.
 * Here we return simple TwiML that plays text-to-speech saying "Connecting to web client" and hangs up.
 * You can replace with <Dial> to bridge with WebRTC / SIP or play media.
 */
app.get("/twiml", (req, res) => {
  const callId = req.query.callId || "n/a";
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">This is a test call from the Hacker Call Terminal. Call id ${callId}.</Say>
  <Pause length="1"/>
  <Say voice="alice">Goodbye.</Say>
  <Hangup/>
</Response>`;
  res.type("application/xml").send(twiml);
});

/**
 * Twilio status callback webhook
 */
app.post("/twilio/status", (req, res) => {
  const body = req.body;
  console.log(`[${new Date().toISOString()}] ↔ Twilio status callback`, body);
  // Your frontend can poll or use SSE/websocket to get these status updates.
  res.sendStatus(200);
});

app.listen(PORT, () => {
  console.log(`⚡ Hacker Call Server (Twilio) running at http://localhost:${PORT}`);
});
