// backend/server.js
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const Groq = require("groq-sdk");

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });


// Init Groq client
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Helper: write buffer to a temp file so we can stream it to Groq Whisper
async function writeTempFile(buffer, ext = ".webm") {
const fname = `audio_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
const fpath = path.join(__dirname, fname);
await fs.promises.writeFile(fpath, buffer);
return fpath;
}

// POST /api/transcribe -> { transcript }
app.post("/api/transcribe", upload.single("audio"), async (req, res) => {
try {
if (!req.file) return res.status(400).json({ error: "No audio uploaded" });


// Guess extension from mimetype (fallback to .webm)
const ext = req.file.mimetype?.includes("mp3")
? ".mp3"
: req.file.mimetype?.includes("wav")
? ".wav"
: req.file.mimetype?.includes("m4a")
? ".m4a"
: ".webm";

const tempPath = await writeTempFile(req.file.buffer, ext);


const transcription = await groq.audio.transcriptions.create({
file: fs.createReadStream(tempPath),
model: "whisper-large-v3",
// language: "en", // optional
// prompt: "Indian English accents; ESL practice", // optional
});

// Clean up temp file
fs.promises.unlink(tempPath).catch(() => {});


const text = transcription?.text || "";
return res.json({ transcript: text });
} catch (err) {
console.error("/api/transcribe error:", err);
return res.status(500).json({ error: "Transcription failed" });
}
});

// POST /api/coach Body: { userText } -> { reply }
app.post("/api/coach", async (req, res) => {
try {
const { userText } = req.body || {};
if (!userText) return res.status(400).json({ error: "userText required" });


const completion = await groq.chat.completions.create({
model: "llama3-8b-8192", // fast & free-tier friendly
messages: [
{
role: "system",
content:
"You are EnglishMate, a friendly ESL coach for Indian learners.\n" +
"Keep answers short. Correct mistakes gently, give one improved sentence, and one practice prompt.",
},
{ role: "user", content: userText },
],
temperature: 0.3,
});
const reply = completion.choices?.[0]?.message?.content?.trim() || "";
return res.json({ reply });
} catch (err) {
console.error("/api/coach error:", err);
return res.status(500).json({ error: "Coach failed" });
}
});


const port = process.env.PORT || 5174;
app.listen(port, () => console.log(`✅ Backend on http://localhost:${port}`));