import { staticFile } from "remotion";
import { toRenderProps } from "../lib/remotion-schema";
import type { ClipsMontageProps } from "../lib/remotion-schema";

// The original hardcoded CLIPS array (see git history of
// src/scenes/ClipsMontage.tsx), translated into lib/remotion-schema.ts's
// shape. Deliberately kept out of lib/remotion-schema.ts and in its own
// file: staticFile() assumes a Remotion rendering/Studio context, and
// "remotion" as a package crashes when evaluated under Next.js's
// react-server bundling condition - so nothing importable from a Next.js
// API route may import "remotion". Only src/Root.tsx and src/MyVideo.tsx
// (Remotion-side, never the Next.js app) import this file.
export function getDefaultClipsMontageProps(): ClipsMontageProps {
  return toRenderProps({
    transitionDurationInFrames: 12,
    captionsFile: "captions/final-merged-video-7.json",
    clips: [
      {
        id: "1",
        label: "On-Camera Hook",
        src: staticFile("videos/clean/1-clean.mp4"),
        trimBeforeSeconds: 0,
        trimAfterSeconds: 134 / 24,
        transitionAfter: "fade",
      },
      {
        id: "2",
        label: "Three Types / Always Free",
        src: staticFile("videos/clean/2-clean.mp4"),
        trimBeforeSeconds: 0,
        trimAfterSeconds: 216 / 24,
        transitionAfter: "fade",
      },
      {
        id: "3",
        label: "12 Months Free",
        src: staticFile("videos/clean/3-clean.mp4"),
        trimBeforeSeconds: 0,
        trimAfterSeconds: 240 / 24,
        transitionAfter: "fade",
      },
      {
        id: "4",
        label: "Trials (visual) / dup audio kept per instruction",
        src: staticFile("videos/clean/4-clean.mp4"),
        trimBeforeSeconds: 0,
        trimAfterSeconds: 240 / 24,
        transitionAfter: "fade",
      },
      {
        id: "5",
        label: "The Catch",
        src: staticFile("videos/clean/5-clean.mp4"),
        trimBeforeSeconds: 0,
        trimAfterSeconds: 240 / 24,
        transitionAfter: "fade",
      },
      // Clip 6 contains an internal duplicated word ("beginner" spoken
      // twice) - split into two sequences with a hard cut over the
      // erroneous repeat, hence transitionAfter: "none" on the first half.
      {
        id: "6a",
        label: "Billing Alerts (part 1)",
        src: staticFile("videos/clean/6-clean.mp4"),
        trimBeforeSeconds: 0,
        trimAfterSeconds: 144 / 24,
        transitionAfter: "none",
      },
      {
        id: "6b",
        label: "Billing Alerts (part 2)",
        src: staticFile("videos/clean/6-clean.mp4"),
        trimBeforeSeconds: 156 / 24,
        trimAfterSeconds: 204 / 24,
        transitionAfter: "fade",
      },
      {
        id: "7",
        label: "Teaser: Creating Your Account",
        src: staticFile("videos/clean/7-clean.mp4"),
        trimBeforeSeconds: 0,
        trimAfterSeconds: 240 / 24,
        transitionAfter: "fade",
      },
    ],
  });
}
