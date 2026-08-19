export const VIDEO_EXTENSIONS = [".mp4", ".mov", ".webm", ".m4v"] as const;

export function hasVideoExtension(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return VIDEO_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

const MIME_TYPES_BY_EXTENSION: Record<string, string> = {
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".m4v": "video/x-m4v",
};

// Used to tell Gemini's Files API what kind of bytes it's receiving (see
// lib/ai/transcribe-clip.ts) - defaults to video/mp4 for any extension not
// in the map above, since that's what every clip in this app actually is.
export function mimeTypeForFile(fileName: string): string {
  const lower = fileName.toLowerCase();
  const extension = VIDEO_EXTENSIONS.find((ext) => lower.endsWith(ext));
  return extension ? MIME_TYPES_BY_EXTENSION[extension] : "video/mp4";
}

export function sanitizeUploadFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}
