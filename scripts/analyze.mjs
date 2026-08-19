import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";

const ffmpeg = "node_modules/ffmpeg-static/ffmpeg.exe";
const clipsDir = "public/videos/myself";
const outDir = "scripts/analysis";
fs.mkdirSync(outDir, { recursive: true });

const files = [
  "1 clip.mp4",
  "2 clip.mp4",
  "3 clip.mp4",
  "4 clip.mp4",
  "5 clip.mp4",
  "6 clip.mp4",
  "7 clip.mp4",
  "8 clip.mp4",
  "9 clip.mp4",
  "10 clip.mp4",
];

function run(args) {
  const result = spawnSync(ffmpeg, args, { encoding: "utf-8" });
  return (result.stderr || "") + (result.stdout || "");
}

for (const file of files) {
  const inPath = path.join(clipsDir, file);
  const base = file.replace(/\s+/g, "-").replace(".mp4", "");

  console.log(`\n=== ${file} ===`);

  const volOut = run(["-i", inPath, "-af", "volumedetect", "-vn", "-f", "null", "-"]);
  fs.writeFileSync(path.join(outDir, `${base}-volumedetect.txt`), volOut);
  const meanMatch = volOut.match(/mean_volume:\s*(-?[\d.]+) dB/);
  const maxMatch = volOut.match(/max_volume:\s*(-?[\d.]+) dB/);
  console.log("mean_volume:", meanMatch?.[1], "max_volume:", maxMatch?.[1]);

  const silOut = run([
    "-i", inPath,
    "-af", "silencedetect=noise=-35dB:d=0.3",
    "-vn", "-f", "null", "-",
  ]);
  fs.writeFileSync(path.join(outDir, `${base}-silence.txt`), silOut);
  const silLines = [...silOut.matchAll(/silence_(start|end): ([\d.]+)/g)].map(m => `${m[1]}:${m[2]}`);
  console.log("silence:", silLines.join(" "));

  const freezeOut = run([
    "-i", inPath,
    "-vf", "freezedetect=n=-30dB:d=0.3",
    "-an", "-f", "null", "-",
  ]);
  fs.writeFileSync(path.join(outDir, `${base}-freeze.txt`), freezeOut);
  const freezeLines = [...freezeOut.matchAll(/freeze_(start|end|duration): ([\d.]+)/g)].map(m => `${m[1]}:${m[2]}`);
  console.log("freeze:", freezeLines.join(" "));
}
