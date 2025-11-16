import { useState } from 'react';
import { Phone, Loader2, PhoneOff } from 'lucide-react';
import './App.css';

export default function App() {
  const [number, setNumber] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);
  const [callSid, setCallSid] = useState(null);

  const log = (level, msg) => {
    const time = new Date().toLocaleTimeString();
    setLogs(l => [`${time} [${level}] ${msg}`, ...l].slice(0, 25));
  };

  const validate = num => /^\+[1-9]\d{7,14}$/.test(num);

  const handleCall = async () => {
    if (!validate(number)) {
      setStatus("Invalid format. Use +91XXXXXXXXXX");
      log("ERROR", "Invalid phone format");
      return;
    }

    setLoading(true);
    setStatus("Dialing…");
    log("INFO", "Requesting call…");

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/call`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number })
      });

      const data = await res.json();
      setLoading(false);

      if (data.success) {
        setStatus("Call initiated — phone is ringing.");
        setCallSid(data.callSid);
        log("OK", `Call SID: ${data.callSid}`);
      } else {
        setStatus("Failed to start call");
        log("ERROR", data.error || "Unknown error");
      }
    } catch (err) {
      setLoading(false);
      setStatus("Network error");
      log("ERROR", err.message);
    }
  };

  const endCall = async () => {
    if (!callSid) {
      log("ERROR", "No active call to hang up");
      return;
    }

    log("INFO", "Ending call...");
    setStatus("Ending call…");

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/hangup/${callSid}`, {
        method: "DELETE"
      });

      setCallSid(null);
      if (res.ok) {
        setStatus("Call ended.");
        log("OK", "Call hung up successfully");
      } else {
        log("ERROR", "Failed to hang up");
      }
    } catch (e) {
      log("ERROR", "Hangup error: " + e.message);
    }
  };

  return (
    <div className="app-container">
      <div className="terminal-card">
        <h1 className="terminal-title">Hacker Call Terminal</h1>
        <div className="terminal-content">
          <input
            placeholder="> Enter phone number (e.g. +919876543210)"
            value={number}
            onChange={e => setNumber(e.target.value)}
            className="terminal-input"
            disabled={loading || !!callSid}
          />

          <div className="controls-row">

            <button
              className="terminal-button"
              onClick={handleCall}
              disabled={loading || !!callSid}
            >
              {loading ? <Loader2 className="spin" /> : <Phone className="icon" />}
              {loading ? " Calling..." : " Call Now"}
            </button>

            {callSid && (
              <button
                className="terminal-button danger"
                onClick={endCall}
              >
                <PhoneOff className="icon" />
                End Call
              </button>
            )}

          </div>

          {status && <div className="terminal-status">{status}</div>}

          <div className="terminal-log">
            {logs.length === 0 ? (
              <div className="terminal-log-empty">No recent activity</div>
            ) : (
              logs.map((line, i) => (
                <div key={i} className="log-line">{line}</div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
