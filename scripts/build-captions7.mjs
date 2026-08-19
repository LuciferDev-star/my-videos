import fs from "fs";
import path from "path";

const PROJECT_ROOT = "C:\\Users\\FCI\\Downloads\\New folder\\my-video";
const capDir = path.join(PROJECT_ROOT, "scripts/captions7");

const FPS = 24;

// Matches ClipsMontage.tsx exactly - see cutlist7.mjs for the audit behind
// every number here (speech end points, visual settle points, transition
// overlap math).
const TRANSITION = 12; // 0.5s @ 24fps

// Each entry: sequence content length in frames (post Phase 6/7 trim),
// and the source clip json + trimBefore(ms)/trimAfter(ms) window used to
// decide which whisper tokens survive into the burned-in captions.
const SEQUENCES = [
  { duration: 134, json: "clip1.json", trimBeforeMs: 0, trimAfterMs: 5583 },
  { duration: 216, json: "clip2.json", trimBeforeMs: 0, trimAfterMs: 9000 },
  { duration: 240, json: "clip3.json", trimBeforeMs: 0, trimAfterMs: 10000 },
  { duration: 240, json: "clip4.json", trimBeforeMs: 0, trimAfterMs: 10000 },
  { duration: 240, json: "clip5.json", trimBeforeMs: 0, trimAfterMs: 10000 },
  // Clip 6 is split into two sequences around the internal duplicate cut
  // (hard cut, no transition, between segA and segB).
  { duration: 144, json: "clip6.json", trimBeforeMs: 0, trimAfterMs: 6000, hardCutAfter: true },
  { duration: 48, json: "clip6.json", trimBeforeMs: 6500, trimAfterMs: 8500 },
  { duration: 240, json: "clip7.json", trimBeforeMs: 0, trimAfterMs: 10000 },
];

// Tokens that are not actual spoken dialogue (sound-effect tags, blank-audio
// markers whisper emits) - never burn these into captions.
const isRealSpeechToken = (text) => {
  const t = text.trim();
  if (t === "") return false;
  if (/^[\[(]/.test(t)) return false; // starts a bracket/paren annotation
  if (/^(BL|ANK|_|AUD|IO|gent|le|music|be|ep|bell|d|ings)$/i.test(t)) return false;
  if (t === "]" || t === ")") return false;
  return true;
};

let cursor = 0; // current frame position of the START of this sequence's content
let lastEndFrame = 0;
const groups = [];

for (const seq of SEQUENCES) {
  const startFrame = cursor;
  const groupOffsetMs = (startFrame / FPS) * 1000;

  const raw = JSON.parse(fs.readFileSync(path.join(capDir, seq.json), "utf-8"));
  const tokens = raw.filter(
    (tok) =>
      isRealSpeechToken(tok.text) &&
      tok.startMs >= seq.trimBeforeMs &&
      tok.startMs < seq.trimAfterMs,
  );

  const remapped = tokens.map((tok) => ({
    text: tok.text,
    startMs: Math.round(groupOffsetMs + (tok.startMs - seq.trimBeforeMs)),
    endMs: Math.round(
      groupOffsetMs + (Math.min(tok.endMs, seq.trimAfterMs) - seq.trimBeforeMs),
    ),
    timestampMs: Math.round(groupOffsetMs + (tok.startMs - seq.trimBeforeMs)),
    confidence: tok.confidence,
  }));

  if (remapped.length > 0) {
    groups.push(remapped);
  }

  // advance cursor to the start of the NEXT sequence's content
  const endFrame = startFrame + seq.duration;
  lastEndFrame = endFrame;
  cursor = seq.hardCutAfter ? endFrame : endFrame - TRANSITION;
}

const outPath = path.join(PROJECT_ROOT, "public/captions/final-merged-video-7.json");
fs.writeFileSync(outPath, JSON.stringify(groups, null, 2));
console.log("wrote", outPath, "with", groups.length, "groups");
console.log("total frames:", lastEndFrame, "=", (lastEndFrame / FPS).toFixed(3), "s");
