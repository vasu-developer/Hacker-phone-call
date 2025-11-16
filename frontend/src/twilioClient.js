import { Device } from "@twilio/voice-sdk";

let device;

export async function initTwilio() {
  const res = await fetch(`${import.meta.env.VITE_API_URL}/token`);
  const { token } = await res.json();
  device = new Device(token, {
    logLevel: "info",
    codecPreferences: ["opus", "pcmu"]
  });
  await device.register();
  console.log("Twilio device ready");
  return device;
}

export async function makeCall(number) {
  if (!device) await initTwilio();
  const connection = await device.connect({ params: { To: number } });
  connection.on("disconnect", () => console.log("Call ended"));
  return connection;
}
