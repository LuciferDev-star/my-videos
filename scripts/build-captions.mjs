import fs from "fs";
import path from "path";
import { CUTLIST } from "./cutlist.mjs";

const PROJECT_ROOT = "C:\\Users\\FCI\\Downloads\\New folder\\my-video";
const capsDir = path.join(PROJECT_ROOT, "scripts/captions");
const FPS = 24;
const TRANSITION_FRAMES = 4; // must match ClipsMontage.tsx TRANSITION_DURATION_IN_FRAMES

// Discards whisper's non-speech annotations, e.g. "[BLANK_AUDIO]",
// "[MUSIC PLAYING]", "(logo popping)", "(gentle music)" - bracketed/parenthesized
// runs of sub-word tokens that aren't part of the spoken script line.
function filterSpeech(tokens) {
  const result = [];
  let inBracket = false;
  for (const t of tokens) {
    const txt = t.text.trim();
    if (!inBracket && (txt === "[" || txt === "(")) {
      inBracket = true;
      continue;
    }
    if (inBracket) {
      if (txt === "]" || txt === ")") inBracket = false;
      continue;
    }
    if (txt.length === 0) continue;
    result.push(t);
  }
  return result;
}

let offsetFrames = 0;
// Grouped per clip (not one flat array) so the TikTok-style page builder never
// combines the tail of one clip's dialogue with the head of the next clip's -
// @remotion/captions merges tokens purely by time gap, and several clip
// boundaries here sit well under its 1500ms combine window.
const groups = [];
let allTokensForLog = [];

for (const clip of CUTLIST) {
  const raw = JSON.parse(
    fs.readFileSync(path.join(capsDir, `clip${clip.n}.json`), "utf-8"),
  );
  const speech = filterSpeech(raw);
  const offsetMs = (offsetFrames * 1000) / FPS;

  const tokens = speech.map((t) => ({
    text: t.text,
    startMs: Math.round(t.startMs + offsetMs),
    endMs: Math.round(t.endMs + offsetMs),
    timestampMs: Math.round((t.timestampMs ?? t.startMs) + offsetMs),
    confidence: t.confidence ?? 1,
  }));
  groups.push(tokens);
  allTokensForLog = allTokensForLog.concat(tokens);

  offsetFrames += clip.trimAfter - clip.trimBefore - TRANSITION_FRAMES;
}

const totalFrames = offsetFrames + TRANSITION_FRAMES;

fs.writeFileSync(
  path.join(PROJECT_ROOT, "public/captions/final-merged-video.json"),
  JSON.stringify(groups, null, 2),
);

console.log("Total merged tokens:", allTokensForLog.length);
console.log("Final timeline duration (frames @24fps):", totalFrames);
console.log("Final timeline duration (sec):", (totalFrames / FPS).toFixed(3));
console.log(allTokensForLog.map((m) => m.text).join(""));
