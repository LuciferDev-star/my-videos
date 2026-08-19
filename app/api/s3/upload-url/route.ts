import { NextResponse } from "next/server";
import { presignPut } from "../../../../lib/aws/presign";
import { hasVideoExtension, sanitizeUploadFileName } from "../../../../lib/video-extensions";

// 15 minutes - enough time for a large video to start uploading directly to
// S3 from the browser (the upload itself doesn't route through this server).
const UPLOAD_URL_EXPIRY_SECONDS = 60 * 15;

export async function POST(request: Request) {
  const bucket = process.env.SOURCE_CLIPS_BUCKET;
  const region = process.env.SOURCE_CLIPS_REGION;
  const prefix = process.env.SOURCE_CLIPS_PREFIX || "";

  const body = await request.json().catch(() => null);
  const fileName = typeof body?.fileName === "string" ? body.fileName : null;
  const contentType =
    typeof body?.contentType === "string" && body.contentType
      ? body.contentType
      : "video/mp4";

  if (!fileName || !hasVideoExtension(fileName)) {
    return NextResponse.json(
      { error: "fileName must be a video file (.mp4, .mov, .webm, .m4v)." },
      { status: 400 },
    );
  }

  // Timestamp-prefixed key: avoids silently overwriting an existing object
  // that happens to share the same original filename.
  const key = `${prefix}${Date.now()}-${sanitizeUploadFileName(fileName)}`;

  // No S3 bucket configured yet - fall back to local disk storage (see
  // lib/local-clips.ts) so upload/browse/render can still be tested end to
  // end. The client always PUTs the file to `uploadUrl` the same way
  // regardless of mode, so nothing else needs to branch on this.
  if (!bucket || !region) {
    return NextResponse.json({
      mode: "local",
      uploadUrl: `/api/local-clips/upload?key=${encodeURIComponent(key)}`,
      key,
    });
  }

  try {
    const uploadUrl = await presignPut(
      region,
      bucket,
      key,
      contentType,
      UPLOAD_URL_EXPIRY_SECONDS,
    );
    return NextResponse.json({ mode: "s3", uploadUrl, key });
  } catch (error) {
    console.error("Failed to presign upload URL", error);
    return NextResponse.json({ error: "Failed to presign upload URL." }, { status: 502 });
  }
}
