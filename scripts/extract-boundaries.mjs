import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";

const ffmpeg = "node_modules/ffmpeg-static/ffmpeg.exe";
const clipsDir = "public/videos/myself";
const outDir = "scripts/thumbs/boundaries";
fs.mkdirSync(outDir, { recursive: true });

// From -35dB silencedetect pass
const silence = {
  1: [0, 0.415167, 9.35244, 10.0053],
  2: [0, 0.412229, 9.18919, 10.0053],
  3: [0, 0.41225, 9.1381, 10.0053],
  4: [0, 0.412208, 9.12677, 10.0053],
  5: [0, 0.417375, 9.18917, 10.0053],
  6: [0, 0.411646, 9.47867, 10.0053],
  7: [0, 0.411542, 9.67475, 10.0053],
  8: [0, 0.411542, 9.67477, 10.0053],
  9: [0, 0.411562, 9.6749, 10.0053],
  10: [0, 0.407625, 9.67494, 10.0053],
};

function extractFrame(inPath, t, outPath) {
  spawnSync(ffmpeg, ["-y", "-ss", String(t), "-i", inPath, "-frames:v", "1", outPath], { encoding: "utf-8" });
}

for (const [clipNum, [, headEnd, tailStart]] of Object.entries(silence)) {
  const inPath = path.join(clipsDir, `${clipNum} clip.mp4`);
  const points = {
    "head-00": 0.05,
    "head-01-silend": Math.max(0, headEnd - 0.05),
    "head-02-after": headEnd + 0.15,
    "head-03-after2": headEnd + 0.4,
    "tail-00-before": Math.max(0, tailStart - 0.3),
    "tail-01-silstart": tailStart + 0.05,
    "tail-02-mid": tailStart + 0.4,
    "tail-03-end": 9.9,
  };
  for (const [label, t] of Object.entries(points)) {
    extractFrame(inPath, t, path.join(outDir, `clip${clipNum}-${label}.jpg`));
  }
  console.log(`clip ${clipNum} done`);
}
