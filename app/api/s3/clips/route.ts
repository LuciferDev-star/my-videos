import { NextResponse } from "next/server";
import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getS3Client } from "../../../../lib/aws/s3-client";
import { presignGet } from "../../../../lib/aws/presign";
import { hasVideoExtension } from "../../../../lib/video-extensions";
import { listLocalClips } from "../../../../lib/local-clips";
import { isS3SourceEnabled } from "../../../../lib/source-storage";

const PREVIEW_URL_EXPIRY_SECONDS = 60 * 60; // 1 hour - browsing-time only,
// re-presigned again at render time (see /api/render/start).

export async function GET() {
  const bucket = process.env.SOURCE_CLIPS_BUCKET;
  const region = process.env.SOURCE_CLIPS_REGION;
  const prefix = process.env.SOURCE_CLIPS_PREFIX || undefined;

  // No S3 bucket configured yet - fall back to whatever's been uploaded to
  // local disk storage (see lib/local-clips.ts) instead of erroring, so
  // this list stays in sync with app/api/s3/upload-url's own fallback.
  if (!isS3SourceEnabled() || !bucket || !region) {
    return NextResponse.json({ clips: listLocalClips(), storage: "local" });
  }

  try {
    const result = await getS3Client(region).send(
      new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix }),
    );

    const videoObjects = (result.Contents ?? []).filter(
      (object) => object.Key && hasVideoExtension(object.Key),
    );

    const clips = await Promise.all(
      videoObjects.map(async (object) => ({
        key: object.Key as string,
        size: object.Size ?? 0,
        lastModified: object.LastModified?.toISOString() ?? null,
        previewUrl: await presignGet(
          region,
          bucket,
          object.Key as string,
          PREVIEW_URL_EXPIRY_SECONDS,
        ),
      })),
    );

    return NextResponse.json({ clips, storage: "s3" });
  } catch (error) {
    console.error("Failed to list S3 clips", error);
    return NextResponse.json({ error: "Failed to list clips from S3." }, { status: 502 });
  }
}
