import fs from "node:fs";
import path from "node:path";
import { hasVideoExtension } from "./video-extensions";

// Fallback clip storage used automatically whenever SOURCE_CLIPS_BUCKET /
// SOURCE_CLIPS_REGION aren't set - lets browsing/upload/render be tested
// end-to-end with zero AWS configuration. Once those env vars are filled
// in, app/api/s3/clips and app/api/s3/upload-url switch to real S3 with no
// code change - this file becomes unused, not a competing code path to
// maintain in production.
export const LOCAL_UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");

const FILE_ROUTE = "/api/local-clips/file";
const LEGACY_PUBLIC_URL_PREFIX = "/uploads/";

export type LocalClip = {
  key: string;
  size: number;
  lastModified: string | null;
  previewUrl: string;
};

export function isSafeUploadKey(key: string): boolean {
  return Boolean(key) && !key.includes("/") && !key.includes("\\") && !key.includes("..");
}

export function localPreviewUrl(key: string): string {
  return `${FILE_ROUTE}?key=${encodeURIComponent(key)}`;
}

function ensureUploadsDir(): void {
  fs.mkdirSync(LOCAL_UPLOADS_DIR, { recursive: true });
}

export function listLocalClips(): LocalClip[] {
  ensureUploadsDir();

  return fs
    .readdirSync(LOCAL_UPLOADS_DIR)
    .filter((fileName) => hasVideoExtension(fileName) && isSafeUploadKey(fileName))
    .map((fileName) => {
      const stat = fs.statSync(path.join(LOCAL_UPLOADS_DIR, fileName));
      return {
        key: fileName,
        size: stat.size,
        lastModified: stat.mtime.toISOString(),
        previewUrl: localPreviewUrl(fileName),
      };
    });
}

export function saveLocalClip(key: string, data: Buffer): LocalClip {
  ensureUploadsDir();
  const filePath = path.join(LOCAL_UPLOADS_DIR, key);
  fs.writeFileSync(filePath, data);
  const stat = fs.statSync(filePath);

  return {
    key,
    size: stat.size,
    lastModified: stat.mtime.toISOString(),
    previewUrl: localPreviewUrl(key),
  };
}

export function isLocalUploadSrc(src: string): boolean {
  return src.includes(FILE_ROUTE) || src.startsWith(LEGACY_PUBLIC_URL_PREFIX);
}

export function localClipKeyFromSrc(src: string): string {
  if (src.startsWith(LEGACY_PUBLIC_URL_PREFIX)) {
    return decodeURIComponent(src.slice(LEGACY_PUBLIC_URL_PREFIX.length));
  }

  try {
    const url = new URL(src, "http://localhost");
    const key = url.searchParams.get("key");
    if (key) {
      return key;
    }
  } catch {
    // Fall through to basename.
  }

  return path.basename(src);
}

// Remotion's local renderer serves the project's public/ folder at /public.
export function toLocalRenderSrc(src: string): string {
  return `/public/uploads/${localClipKeyFromSrc(src)}`;
}

export function readLocalClip(src: string): Buffer {
  const fileName = localClipKeyFromSrc(src);
  if (!isSafeUploadKey(fileName)) {
    throw new Error("Invalid local clip key.");
  }
  return fs.readFileSync(path.join(LOCAL_UPLOADS_DIR, fileName));
}
