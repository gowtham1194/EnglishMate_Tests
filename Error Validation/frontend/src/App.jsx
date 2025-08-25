import { useRef, useState } from "react";
import "./App.css";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

export default function App() {
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const [recording, setRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [reply, setReply] = useState("");
  const [feedback, setFeedback] = useState([]);
  const [error, setError] = useState("");

  // 🎤 Start Recording
  async function startRecording() {
    try {
      setError("");
      setTranscript("");
      setReply("");
      setFeedback([]);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      mr.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      mr.onstop = onStop;
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
    } catch (e) {
      setError("❌ Mic permission denied or unavailable.");
    }
  }

  // ⏹ Stop Recording
  function stopRecording() {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  }

  // 🎯 Upload + Get Response
  async function onStop() {
    setLoading(true);
    try {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      const fd = new FormData();
      fd.append("audio", blob, "speech.webm");

      const r = await fetch(`${API_BASE}/api/interview`, {
        method: "POST",
        body: fd,
      });

      const j = await r.json();
      if (j.error) throw new Error(j.error);

      setTranscript(j.transcript || "");
      setReply(j.gptReply || "");
      setFeedback(j.feedback || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app">
      <h1>🎤 EnglishMate - AI Interviewer</h1>

      {/* Error */}
      {error && <p className="error">❌ {error}</p>}

      {/* Record Button */}
      <button onClick={recording ? stopRecording : startRecording}>
        {recording ? "⏹ Stop Recording" : "🎙 Start Recording"}
      </button>

      {/* Loading */}
      {loading && <p className="loading">⏳ Processing...</p>}

      {/* Transcript */}
      {transcript && (
        <div className="card">
          <p className="transcript">
            <strong>You said:</strong> {transcript}
          </p>
        </div>
      )}

      {/* AI Reply */}
      {reply && (
        <div className="card">
          <p className="coach">
            <strong>AI Coach:</strong> {reply}
          </p>
        </div>
      )}

      {/* Feedback */}
      {feedback.length > 0 && (
        <div className="card">
          <p><strong>Feedback:</strong></p>
          {feedback.map((f, i) => (
            <p key={i}>
              <span className="error-text">❌ {f.error}</span> ➝{" "}
              <span className="suggest-text">✅ {f.suggestion}</span>
            </p>
          ))}
        </div>
      )}

      {/* No issues */}
      {!loading && transcript && feedback.length === 0 && (
        <p className="ok">✅ No issues detected. Good job!</p>
      )}
    </div>
  );
}
