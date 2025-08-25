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



dotenv.config();

if (!process.env.GROQ_API_KEY) {
  console.error("❌ GROQ_API_KEY is missing! Check your .env file.");
  process.exit(1);
}

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });


// Helper: write buffer to a temp file
async function writeTempFile(buffer, ext = ".webm") {
  const fname = `audio_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
  const fpath = path.join(__dirname, fname);
  await fs.promises.writeFile(fpath, buffer);
  return fpath;
}

// ✅ /api/interview → handles both transcription + GPT feedback
app.post("/api/interview", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No audio uploaded" });

    // Pick extension
    const ext = req.file.mimetype?.includes("mp3")
      ? ".mp3"
      : req.file.mimetype?.includes("wav")
      ? ".wav"
      : req.file.mimetype?.includes("m4a")
      ? ".m4a"
      : ".webm";

    const tempPath = await writeTempFile(req.file.buffer, ext);

    // Step 1: Transcribe
    const transcription = await groq.audio.transcriptions.create({
      file: fs.createReadStream(tempPath),
      model: "whisper-large-v3",
    });
    fs.promises.unlink(tempPath).catch(() => {});

    const transcript = transcription?.text || "";

    // Step 2: Ask GPT for corrections
    const completion = await groq.chat.completions.create({
      model: "llama3-8b-8192",
      messages: [
        {
          role: "system",
          content:
            "You are an English teacher. Correct grammar mistakes. " +
            "Reply in strict JSON: { gptReply: string, feedback: [{ error: string, suggestion: string }] }",
        },
        { role: "user", content: transcript },
      ],
      temperature: 0.3,
    });

    let parsed = {};
    try {
      parsed = JSON.parse(completion.choices[0].message.content.trim());
    } catch (e) {
      parsed = { gptReply: completion.choices[0].message.content.trim(), feedback: [] };
    }

    return res.json({
      transcript,
      gptReply: parsed.gptReply || "",
      feedback: parsed.feedback || [],
    });
  } catch (err) {
    console.error("/api/interview error:", err);
    return res.status(500).json({ error: "Interview processing failed" });
  }
});

const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`✅ Backend on http://localhost:${port}`));
