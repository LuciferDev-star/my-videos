import path from "node:path";
import fs from "node:fs";
import { bundle } from "@remotion/bundler";
import {
  ensureBrowser,
  renderMedia,
  selectComposition,
} from "@remotion/renderer";
import type { ClipsMontageProps } from "../remotion-schema";

export const LOCAL_OUTPUT_DIR = path.join(process.cwd(), "out");
const ENTRY_POINT = path.join(process.cwd(), "src", "index.ts");
const PUBLIC_DIR = path.join(process.cwd(), "public");

export async function renderLocally(
  inputProps: ClipsMontageProps,
  options?: { onProgress?: (progress: number) => void },
): Promise<{ fileName: string }> {
  await ensureBrowser();

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
    chromiumOptions: {
      enableMultiProcessOnLinux: true,
    },
    onProgress: ({ progress }) => {
      options?.onProgress?.(progress);
    },
  });

  return { fileName };
}
