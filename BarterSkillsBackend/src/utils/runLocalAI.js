import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs/promises";
import { downloadFile } from "./cloudinary.js";
import axios from "axios";
import ffmpegPath from "ffmpeg-static";

export async function fetchQuestions(summary) {
  const res = await axios.post("http://localhost:8001/generate-questions", { summary });
  return res.data.questions;
}

const execFileAsync = promisify(execFile);
const WHISPER_MODEL = "small.en";
const HF_API_KEY = process.env.HF_API_KEY;

const OUTPUT_DIR = path.resolve("public", "temp");

async function resolveWhisperCommand() {
  if (process.env.WHISPER_CMD) {
    return process.env.WHISPER_CMD;
  }

  const localWhisper = path.resolve(process.cwd(), "..", "whisper_env", "Scripts", "whisper.exe");
  try {
    await fs.access(localWhisper);
    return localWhisper;
  } catch {
    return "whisper";
  }
}

function parseTranscriptFromStdout(stdout) {
  return (stdout || "")
    .split(/\r?\n/)
    .map((line) => line.replace(/^\[\d{2}:\d{2}\.\d{3} --> [^\]]+\]\s*/, "").trim())
    .filter((line) => line && !/^\[/.test(line))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function runLocalAI(videoUrl, tempPath) {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const jobId = path.basename(tempPath, path.extname(tempPath));
  const jobDir = path.join(OUTPUT_DIR, jobId);
  await fs.mkdir(jobDir, { recursive: true });

  const inputPath = path.join(jobDir, `${jobId}.mp4`);
  await downloadFile(videoUrl, inputPath);

  const transcriptPath = path.join(jobDir, `${jobId}.txt`);

  const whisperEnv = {
    ...process.env,
  };

  if (ffmpegPath) {
    const ffmpegDir = path.dirname(ffmpegPath);
    whisperEnv.PATH = `${ffmpegDir};${whisperEnv.PATH || ""}`;
  }

  const whisperCmd = await resolveWhisperCommand();

  try {
    const { stdout = "" } = await execFileAsync(
      whisperCmd,
      [
        inputPath,
        "--model", WHISPER_MODEL,
        "--language", "en",
        "--output_format", "txt",
        "--output_dir", jobDir,
      ],
      {
        env: whisperEnv,
        windowsHide: true,
        maxBuffer: 10 * 1024 * 1024,
      }
    );

    const transcriptFiles = await fs.readdir(jobDir);
    const fallback = transcriptFiles.find((entry) => entry.endsWith(".txt"));

    if (!(await fs.access(transcriptPath).then(() => true).catch(() => false))) {
      const stdoutTranscript = parseTranscriptFromStdout(stdout);
      if (stdoutTranscript) {
        const summary = await getT5Summary(stdoutTranscript);

        await Promise.all([
          fs.unlink(inputPath).catch(() => {}),
          fallback ? fs.unlink(path.join(jobDir, fallback)).catch(() => {}) : Promise.resolve(),
        ]);
        await fs.rm(jobDir, { recursive: true, force: true }).catch(() => {});

        return { transcript: stdoutTranscript, summary };
      }

      if (!fallback) {
        console.warn(`Whisper did not create a transcript file at ${transcriptPath}. Using fallback summary.`);
        await fs.unlink(inputPath).catch(() => {});
        await fs.rm(jobDir, { recursive: true, force: true }).catch(() => {});
        return {
          transcript: "",
          summary: "Transcript generation unavailable.",
        };
      }

      const transcript = await fs.readFile(path.join(jobDir, fallback), "utf-8");
      const summary = await getT5Summary(transcript);

      await Promise.all([
        fs.unlink(inputPath).catch(() => {}),
        fs.unlink(path.join(jobDir, fallback)).catch(() => {}),
      ]);
      await fs.rm(jobDir, { recursive: true, force: true }).catch(() => {});

      return { transcript, summary };
    }

    const transcript = await fs.readFile(transcriptPath, "utf-8");

    const summary = await getT5Summary(transcript);

    await Promise.all([
      fs.unlink(inputPath).catch(() => {}),
      fs.unlink(transcriptPath).catch(() => {}),
    ]);
    await fs.rm(jobDir, { recursive: true, force: true }).catch(() => {});

    return { transcript, summary };
  } catch (error) {
    throw new Error(
      `Whisper failed: ${
        error?.stderr ||
        error?.stdout ||
        error?.message ||
        "unknown error"
      }`
    );
  }
}

// async function getT5Summary(transcript) {
//   const model = "sshleifer/distilbart-cnn-12-6";

//   console.log("🚀 Starting HF summarization");
//   console.log("Transcript length:", transcript.length);

//   try {
//     const response = await axios.post(
//       `https://api-inference.huggingface.co/models/${model}`,
//       { inputs: transcript },
//       {
//         headers: {
//           Authorization: `Bearer ${HF_API_KEY}`,
//           "Content-Type": "application/json"
//         },
//         timeout: 30000
//       }
//     );

//     console.log("✅ HF summarization succeeded");

//     if (Array.isArray(response.data) && response.data[0]?.summary_text) {
//       console.log("Summary:", response.data[0].summary_text);
//       return response.data[0].summary_text;
//     }

//     console.log("⚠️ Unexpected HF response:", response.data);
//     return buildLocalSummary(transcript);

//   } catch (err) {
//     console.error("❌ HF summarization failed");
//     console.error(err?.response?.data || err.message);

//     console.log("⚠️ Using local fallback summary");
//     return buildLocalSummary(transcript);
//   }
// }
async function getT5Summary(transcript) {
  console.log("📝 Generating local summary");
  console.log("Transcript length:", transcript.length);

  return buildBetterSummary(transcript);
}

// function buildLocalSummary(transcript) {
//   const normalized = (transcript || "").replace(/\s+/g, " ").trim();

//   if (!normalized) {
//     return "Transcript generation unavailable.";
//   }

//   const sentences = normalized
//     .split(/(?<=[.!?])\s+/)
//     .map((sentence) => sentence.trim())
//     .filter(Boolean);

//   if (!sentences.length) {
//     return normalized.slice(0, 500);
//   }

//   const summary = sentences.slice(0, 3).join(" ");
//   return summary.length > 900 ? `${summary.slice(0, 900).trim()}...` : summary;
// }
function buildBetterSummary(transcript) {
  const normalized = (transcript || "")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return "Transcript generation unavailable.";
  }

  const sentences = normalized
    .split(/(?<=[.!?])\s+/)
    .map(sentence => sentence.trim())
    .filter(Boolean);

  if (sentences.length <= 5) {
    return sentences.join(" ");
  }

  const firstPart = sentences.slice(0, 2);

  const middleIndex = Math.floor(sentences.length / 2);
  const middlePart = sentences.slice(
    Math.max(0, middleIndex - 1),
    Math.min(sentences.length, middleIndex + 1)
  );

  const lastPart = sentences.slice(-2);

  const summary = [
    ...firstPart,
    ...middlePart,
    ...lastPart
  ].join(" ");

  return summary.length > 1200
    ? summary.slice(0, 1200) + "..."
    : summary;
}