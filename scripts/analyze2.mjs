import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";

const ffmpeg = "node_modules/ffmpeg-static/ffmpeg.exe";
const clipsDir = "public/videos/myself";
const outDir = "scripts/analysis";

const files = Array.from({ length: 10 }, (_, i) => `${i + 1} clip.mp4`);

function run(args) {
  const result = spawnSync(ffmpeg, args, { encoding: "utf-8" });
  return (result.stderr || "") + (result.stdout || "");
}

for (const file of files) {
  const inPath = path.join(clipsDir, file);
  const base = file.replace(/\s+/g, "-").replace(".mp4", "");

  const freezeOut = run([
    "-i", inPath,
    "-vf", "freezedetect=n=-60dB:d=0.2",
    "-an", "-f", "null", "-",
  ]);
  fs.writeFileSync(path.join(outDir, `${base}-freeze60.txt`), freezeOut);
  const freezeLines = [...freezeOut.matchAll(/freeze_(start|end|duration): ([\d.]+)/g)].map(m => `${m[1]}:${m[2]}`);
  console.log(`${file}: ${freezeLines.join(" ")}`);
}
