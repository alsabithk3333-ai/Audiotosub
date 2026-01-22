import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import OpenAI from "openai";

const app = express();
const PORT = process.env.PORT || 10000;

// Ensure folders exist
fs.mkdirSync("uploads", { recursive: true });
fs.mkdirSync("outputs", { recursive: true });

// Multer setup
const upload = multer({ dest: "uploads/" });

// OpenAI client (GPT-4o Audio)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 15 * 60 * 1000 // 15 minutes for long audio
});

// Serve frontend
app.get("/", (req, res) => {
  res.sendFile(path.join(process.cwd(), "index.html"));
});

// Upload & process audio
app.post("/upload", upload.single("audio"), async (req, res) => {
  try {
    const audioPath = req.file.path;
    const audioBuffer = fs.readFileSync(audioPath);

    console.log("Audio received, starting transcription...");

    const response = await openai.responses.create({
      model: "gpt-4o-audio-preview",
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: "Transcribe this audio clearly as subtitles." },
            {
              type: "input_audio",
              audio: audioBuffer,
              format: "mp3"
            }
          ]
        }
      ]
    });

    const transcriptText = response.output_text;

    // Save transcript
    const outputFile = `outputs/${req.file.filename}.txt`;
    fs.writeFileSync(outputFile, transcriptText);

    // Cleanup upload
    fs.unlinkSync(audioPath);

    res.json({
      success: true,
      text: transcriptText,
      download: `/${outputFile}`
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// Download result
app.get("/outputs/:file", (req, res) => {
  res.download(path.join("outputs", req.params.file));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
