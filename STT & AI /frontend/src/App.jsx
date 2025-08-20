import { useRef, useState } from "react";
import "./App.css";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5174";

export default function App() {
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const [recording, setRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");

  async function startRecording() {
    try {
      setError("");
      setTranscript("");
      setReply("");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      mr.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      mr.onstop = onStop;
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
    } catch (e) {
      setError("Mic permission denied or unavailable.");
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  }

  async function onStop() {
    setLoading(true);
    try {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      const fd = new FormData();
      fd.append("audio", blob, "speech.webm");

      // 1) Transcribe
      const r1 = await fetch(`${API_BASE}/api/transcribe`, {
        method: "POST",
        body: fd,
      });
      const j1 = await r1.json();
      if (j1.error) throw new Error(j1.error);
      setTranscript(j1.transcript || "");

      // 2) Coach reply
      const r2 = await fetch(`${API_BASE}/api/coach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userText: j1.transcript || "" }),
      });
      const j2 = await r2.json();
      if (j2.error) throw new Error(j2.error);
      setReply(j2.reply || "");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app">
      <h1>🎤 EnglishMate - STT + AI Coach</h1>

      {error && <p className="error">❌ {error}</p>}

      <button onClick={recording ? stopRecording : startRecording}>
        {recording ? "⏹ Stop Recording" : "🎙 Start Recording"}
      </button>

      {loading && <p className="loading">⏳ Processing...</p>}

      {transcript && (
        <div className="card">
          <p className="transcript">
            <strong>You said:</strong> {transcript}
          </p>
        </div>
      )}

      {reply && (
        <div className="card">
          <p className="coach">
            <strong>AI Coach:</strong> {reply}
          </p>
        </div>
      )}
    </div>
  );
}
