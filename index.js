import express from "express";
import multer from "multer";
import fs from "fs";
import OpenAI from "openai";

const app = express();
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 500 * 1024 * 1024 }
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const jobs = {};

app.use(express.static("public"));

// Upload MP3
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

    const outputPath = `outputs/${jobId}.srt`;
    fs.writeFileSync(outputPath, transcription);

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

// Download SRT
app.get("/download/:file", (req, res) => {
  res.download(`outputs/${req.params.file}`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port", PORT));
