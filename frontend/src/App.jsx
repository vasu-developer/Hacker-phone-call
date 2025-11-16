import { useState, useRef, useEffect } from 'react';
import { Phone, Loader2, MicOff, Mic } from 'lucide-react';
import './App.css';
import { Device } from '@twilio/voice-sdk';

export default function App() {
  const [number, setNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [logs, setLogs] = useState([]);
  const [connected, setConnected] = useState(false);
  const [muted, setMuted] = useState(false);

  const deviceRef = useRef(null);
  const connRef = useRef(null);

  const pushLog = (level, text) => {
    const prefix = level === 'error' ? '[ERROR]' : level === 'info' ? '[INFO]' : '[OK]';
    const time = new Date().toLocaleTimeString();
    setLogs((l) => [`${time} ${prefix} ${text}`, ...l].slice(0, 20));
  };

  const validateNumber = (num) => {
    if (!num || num.trim() === '') return { ok: false, msg: 'No number entered' };
    const cleaned = num.trim();
    if (!/^\+[0-9]{8,15}$/.test(cleaned)) return { ok: false, msg: 'Invalid format. Use +<countrycode><number>' };
    return { ok: true };
  };

  // Initialize Twilio Device and register it using a token from the server
  const initTwilio = async () => {
    if (deviceRef.current) return deviceRef.current;
    pushLog('info', 'Requesting Twilio token...');
    const resp = await fetch(`${import.meta.env.VITE_API_URL}/token`);
    if (!resp.ok) throw new Error('Failed to fetch Twilio token');
    const { token } = await resp.json();

    const device = new Device(token, { logLevel: 'info', codecPreferences: ['opus', 'pcmu'] });
    deviceRef.current = device;

    device.on('ready', () => pushLog('ok', 'Twilio device ready'));
    device.on('error', (err) => pushLog('error', `Device error: ${err?.message || err}`));
    device.on('connect', (conn) => {
      connRef.current = conn;
      setConnected(true);
      setStatus('Call connected — you can speak now');
      pushLog('ok', `Connected (params: ${JSON.stringify(conn.parameters || {})})`);

      conn.on('disconnect', () => {
        setConnected(false);
        setLoading(false);
        connRef.current = null;
        setStatus('Call ended.');
        pushLog('info', 'Call disconnected');
      });

      conn.on('rejected', () => pushLog('error', 'Call rejected'));
      conn.on('error', (e) => pushLog('error', `Connection error: ${e?.message || e}`));
    });

    device.on('disconnect', () => {
      setConnected(false);
      setLoading(false);
      connRef.current = null;
      pushLog('info', 'Device disconnected');
    });

    await device.register();
    return device;
  };

  const makeCall = async (toNumber) => {
    const device = await initTwilio();
    pushLog('info', `Placing call to ${toNumber}`);
    setStatus('Connecting to Twilio bridge...');
    // params 'To' will be available to your TwiML app
    const connection = await device.connect({ params: { To: toNumber } });
    return connection;
  };

  const hangup = () => {
    try {
      if (connRef.current) connRef.current.disconnect();
      else if (deviceRef.current) deviceRef.current.disconnectAll();
      setConnected(false);
      setMuted(false);
      setStatus('Call ended.');
      pushLog('info', 'Hung up');
    } catch (e) {
      pushLog('error', 'Error hanging up: ' + (e?.message || e));
    }
  };

  const toggleMute = () => {
    if (!connRef.current) return;
    try {
      const newMuted = !muted;
      connRef.current.mute(newMuted);
      setMuted(newMuted);
      pushLog('info', newMuted ? 'Microphone muted' : 'Microphone unmuted');
    } catch (e) {
      pushLog('error', 'Mute error: ' + (e?.message || e));
    }
  };

  const handleCall = async () => {
    const v = validateNumber(number);
    if (!v.ok) {
      setStatus(v.msg);
      pushLog('error', v.msg);
      return;
    }

    setLoading(true);
    setStatus('Dialing...');
    pushLog('info', `Attempting call to ${number}`);

    try {
      await makeCall(number);
      // device.connect will trigger connection events which update state
    } catch (err) {
      const msg = err?.message || 'Call failed';
      setStatus(msg);
      pushLog('error', `Call error: ${msg}`);
      setLoading(false);
    }
  };

  // cleanup on unmount
  useEffect(() => {
    return () => {
      try {
        if (deviceRef.current) deviceRef.current.destroy();
      } catch (e) {}
    };
  }, []);

  return (
    <div className="app-container">
      <div className="terminal-card">
        <h1 className="terminal-title">Hacker Call Terminal</h1>
        <div className="terminal-content">
          <input
            placeholder="> Enter mobile number (e.g. +919876543210)"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            className="terminal-input"
            disabled={connected}
          />

          <div className="controls-row">
            <button
              onClick={handleCall}
              disabled={loading || connected}
              className="terminal-button"
            >
              {loading ? <Loader2 className="spin" /> : <Phone className="icon" />} 
              {loading ? ' Connecting...' : ' Call Now'}
            </button>

            {connected && (
              <>
                <button onClick={toggleMute} className="terminal-button secondary">
                  {muted ? <MicOff className="icon" /> : <Mic className="icon" />} {muted ? 'Unmute' : 'Mute'}
                </button>

                <button onClick={hangup} className="terminal-button danger">End Call</button>
              </>
            )}
          </div>

          {status && <div className="terminal-status">{status}</div>}

          <div className="terminal-log">
            {logs.length === 0 ? (
              <div className="terminal-log-empty">No recent activity</div>
            ) : (
              logs.map((l, i) => (
                <div key={i} className={`log-line ${l.includes('[ERROR]') ? 'log-error' : l.includes('[OK]') ? 'log-ok' : 'log-info'}`}>
                  {l}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
