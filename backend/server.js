// server/index.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { randomUUID } from "crypto";
import Twilio from "twilio";

dotenv.config();

const app = express();
app.use(cors());
// CORS middleware
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }

  next();
});

app.use(express.json());

const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_FROM_NUMBER,
  WEBHOOK_BASE_URL,
  PORT = 3000,
} = process.env;

if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) {
  console.error("❌ Missing Twilio environment variables");
  process.exit(1);
}

const twClient = Twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

// E.164 validator
const E164_REGEX = /^\+[1-9]\d{7,14}$/;

// Root test
app.get("/", (req, res) => res.send("🚀 Hacker Call Backend (Twilio Ready)"));

// MAIN CALL ROUTE
app.post("/call", async (req, res) => {
  const raw = req.body?.number;
  const number = raw?.trim();
  const now = new Date().toISOString();

  console.log(`[${now}] ▶ CALL REQUEST:`, number);

  if (!E164_REGEX.test(number)) {
    return res.status(400).json({ success: false, error: "Invalid number format. Use +91XXXXXXXXXX" });
  }

  try {
    const call = await twClient.calls.create({
      to: number,
      from: TWILIO_FROM_NUMBER,
      url: `${WEBHOOK_BASE_URL}/twiml?to=${encodeURIComponent(number)}`,
      statusCallback: `${WEBHOOK_BASE_URL}/twilio/status`,
      statusCallbackMethod: "POST",
      statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
    });

    console.log(`[${now}] 📞 Twilio Call SID: ${call.sid}`);
    res.json({ success: true, callSid: call.sid });

  } catch (err) {
    console.error("❌ Twilio Error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// TWiML — Tell Twilio what to do
app.get("/twiml", (req, res) => {
  const number = decodeURIComponent((req.query.to || "").trim());

  if (!E164_REGEX.test(number)) {
    return res.type("text/xml").send(`
      <Response>
        <Say>Invalid number. Cannot place call.</Say>
        <Hangup/>
      </Response>
    `);
  }

  console.log(`📡 TwiML Dial → ${number}`);

  const twiml = `
    <?xml version="1.0" encoding="UTF-8"?>
    <Response>
      <Dial>${number}</Dial>
    </Response>
  `;

  res.type("text/xml").send(twiml);
});

// Twilio call progress events
app.post("/twilio/status", (req, res) => {
  console.log(`🔄 STATUS CALLBACK @ ${new Date().toISOString()}`, req.body);
  res.sendStatus(200);
});

app.delete("/hangup/:sid", async (req, res) => {
  const callSid = req.params.sid;

  try {
    await twClient.calls(callSid).update({ status: "completed" });
    console.log("🛑 Call ended:", callSid);
    res.json({ success: true });
  } catch (err) {
    console.error("Hangup error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});


// Start server
app.listen(PORT, () => {
  console.log(`⚡ Server running on :${PORT}`);
  console.log(`🌐 Webhook Base: ${WEBHOOK_BASE_URL}`);
});
