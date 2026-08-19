import path from "path";
import fs from "fs";
import { spawnSync } from "child_process";

const PROJECT_ROOT = "C:\\Users\\FCI\\Downloads\\New folder\\my-video";
const scratch =
  "C:\\Users\\FCI\\AppData\\Local\\Temp\\claude\\C--Users-FCI-Downloads-New-folder-my-video\\d5070493-2501-4d86-b7fa-cd3515349c48\\scratchpad";

// Avoid a bug in @remotion/install-whisper-cpp where it downloads/unzips
// relative to process.cwd() without quoting - breaks when cwd has spaces.
process.chdir(scratch);

const { downloadWhisperModel, installWhisperCpp, transcribe, toCaptions } =
  await import("@remotion/install-whisper-cpp");

const to = path.join(scratch, "whisper.cpp");
const ffmpeg = path.join(PROJECT_ROOT, "node_modules/ffmpeg-static/ffmpeg.exe");
const clipsDir = path.join(PROJECT_ROOT, "public/videos/myself");
const wavDir = path.join(scratch, "wav");
const outDir = path.join(PROJECT_ROOT, "scripts/captions7");
fs.mkdirSync(wavDir, { recursive: true });
fs.mkdirSync(outDir, { recursive: true });

await installWhisperCpp({ to, version: "1.5.5" });
await downloadWhisperModel({ model: "medium.en", folder: to });

for (let i = 1; i <= 7; i++) {
  const inPath = path.join(clipsDir, `${i} clip.mp4`);
  const wavPath = path.join(wavDir, `clip${i}.wav`);

  spawnSync(ffmpeg, ["-y", "-i", inPath, "-ar", "16000", "-ac", "1", wavPath], {
    encoding: "utf-8",
  });

  const whisperCppOutput = await transcribe({
    model: "medium.en",
    whisperPath: to,
    whisperCppVersion: "1.5.5",
    inputPath: wavPath,
    tokenLevelTimestamps: true,
  });

  const { captions } = toCaptions({ whisperCppOutput });
  fs.writeFileSync(
    path.join(outDir, `clip${i}.json`),
    JSON.stringify(captions, null, 2),
  );
  console.log(`clip ${i} transcribed:`, captions.map((c) => c.text).join(""));
}
