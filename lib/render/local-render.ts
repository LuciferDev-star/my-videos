import path from "node:path";
import fs from "node:fs";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import type { ClipsMontageProps } from "../remotion-schema";

// Local render path: for testing on this machine before AWS Lambda is set
// up (RENDER_TARGET=local, the default - see app/api/render/start/route.ts).
// Spawns the same headless-Chrome renderer `npx remotion render` uses, just
// driven programmatically, and writes straight to out/ instead of S3.
export const LOCAL_OUTPUT_DIR = path.join(process.cwd(), "out");
const ENTRY_POINT = path.join(process.cwd(), "src", "index.ts");
const PUBLIC_DIR = path.join(process.cwd(), "public");

export async function renderLocally(
  inputProps: ClipsMontageProps,
): Promise<{ fileName: string }> {
  // publicDir isn't reliably auto-detected here - without it, staticFile()
  // assets (the default clips' videos/captions) 404 inside the bundle.
  const serveUrl = await bundle({ entryPoint: ENTRY_POINT, publicDir: PUBLIC_DIR });

  const composition = await selectComposition({
    serveUrl,
    id: "ClipsMontage",
    inputProps,
  });

  fs.mkdirSync(LOCAL_OUTPUT_DIR, { recursive: true });

  const fileName = `final-video-${Date.now()}.mp4`;

  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    outputLocation: path.join(LOCAL_OUTPUT_DIR, fileName),
    inputProps,
  });

  return { fileName };
}
