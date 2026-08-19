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

// Served by Next's own static file handling (anything under public/ is
// served at the matching root path), so this doubles as both the browser
// preview URL and, after prefixing with /public at local-render time (see
// app/api/render/start/route.ts), the path the local Remotion render
// bundle serves it at too.
const PUBLIC_URL_PREFIX = "/uploads/";

export type LocalClip = {
  key: string;
  size: number;
  lastModified: string | null;
  previewUrl: string;
};

function ensureUploadsDir(): void {
  fs.mkdirSync(LOCAL_UPLOADS_DIR, { recursive: true });
}

export function listLocalClips(): LocalClip[] {
  ensureUploadsDir();

  return fs
    .readdirSync(LOCAL_UPLOADS_DIR)
    .filter((fileName) => hasVideoExtension(fileName))
    .map((fileName) => {
      const stat = fs.statSync(path.join(LOCAL_UPLOADS_DIR, fileName));
      return {
        key: fileName,
        size: stat.size,
        lastModified: stat.mtime.toISOString(),
        previewUrl: `${PUBLIC_URL_PREFIX}${fileName}`,
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
    previewUrl: `${PUBLIC_URL_PREFIX}${key}`,
  };
}

// A clip whose src is one of these local-upload URLs (as opposed to an
// https:// S3 URL) needs a path rewrite before being handed to the local
// render pipeline - see prepareClipsForLocalRender in
// app/api/render/start/route.ts.
export function isLocalUploadSrc(src: string): boolean {
  return src.startsWith(PUBLIC_URL_PREFIX);
}

export function toLocalRenderSrc(src: string): string {
  return `/public${src}`;
}

// Reads a local-upload clip's bytes straight off disk, for server-side work
// that needs the actual file content rather than a URL to hand to the
// browser - see app/api/ai/transcribe-clip/route.ts.
export function readLocalClip(src: string): Buffer {
  const fileName = src.slice(PUBLIC_URL_PREFIX.length);
  return fs.readFileSync(path.join(LOCAL_UPLOADS_DIR, fileName));
}
