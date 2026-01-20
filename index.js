import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import OpenAI from "openai";

const app = express();

// Ensure folders exist
["uploads", "outputs"].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
});

// Multer config
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 500 * 1024 * 1024 }
});

// OpenAI
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// In-memory job store
const jobs = {};

// Serve index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(process.cwd(), "index.html"));
});

// Upload audio
app.post("/upload", upload.single("audio"), (req, res) => {
  const jobId = Date.now().toString();

  jobs[jobId] = { status: "processing" };

  processAudio(jobId, req.file.path);

  res.json({ jobId });
});

// Background processing
async function processAudio(jobId, audioPath) {
  try {
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(audioPath),
      model: "whisper-1",
      response_format: "srt"
    });

    const outFile = `outputs/${jobId}.srt`;
    fs.writeFileSync(outFile, transcription);

    jobs[jobId].status = "done";
    jobs[jobId].file = `/download/${jobId}.srt`;

    fs.unlinkSync(audioPath);

  } catch (err) {
    console.error(err);
    jobs[jobId].status = "error";
  }
}

// Job status
app.get("/status/:jobId", (req, res) => {
  res.json(jobs[req.params.jobId] || { status: "unknown" });
});

// Download subtitle
app.get("/download/:file", (req, res) => {
  res.download(path.join(process.cwd(), "outputs", req.params.file));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port", PORT));
