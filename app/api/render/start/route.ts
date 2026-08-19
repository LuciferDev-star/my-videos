import { NextResponse } from "next/server";
import { ClipsMontagePropsSchema } from "../../../../lib/remotion-schema";
import type { ClipsMontageProps } from "../../../../lib/remotion-schema";
import { presignGet } from "../../../../lib/aws/presign";
import { startRender } from "../../../../lib/aws/lambda-render";
import { renderLocally } from "../../../../lib/render/local-render";
import { isLocalUploadSrc, toLocalRenderSrc } from "../../../../lib/local-clips";

// Long enough to outlast a slow Lambda render, well past the ~1hr
// browsing-time URLs used while the editor is still arranging clips.
const RENDER_URL_EXPIRY_SECONDS = 60 * 60 * 6;

function isLambdaTarget(): boolean {
  return process.env.RENDER_TARGET === "lambda";
}

async function refreshS3ClipUrls(props: ClipsMontageProps): Promise<ClipsMontageProps> {
  const bucket = process.env.SOURCE_CLIPS_BUCKET;
  const region = process.env.SOURCE_CLIPS_REGION;

  // No bucket configured (e.g. testing locally with only the built-in
  // default clips) - nothing to refresh, leave clip.src as-is.
  if (!bucket || !region) {
    return props;
  }

  const clips = await Promise.all(
    props.clips.map(async (clip) => {
      if (!clip.src.startsWith("http")) {
        return clip;
      }
      // The client may be holding a stale browsing-time presigned URL by
      // the time it clicks Generate - clip.id is the S3 key for any clip
      // that came from the bucket browser, so re-mint a fresh URL from it.
      return {
        ...clip,
        src: await presignGet(region, bucket, clip.id, RENDER_URL_EXPIRY_SECONDS),
      };
    }),
  );

  return { ...props, clips };
}

// The Next.js dev/prod server serves public/uploads/<file> at /uploads/<file>
// (Player preview relies on this). The local render pipeline is a *separate*
// headless-Chrome + static-server process, spun up from a fresh bundle that
// copies public/ under its own /public path - so the same file needs a
// different URL there. See lib/local-clips.ts.
function prepareClipsForLocalRender(props: ClipsMontageProps): ClipsMontageProps {
  return {
    ...props,
    clips: props.clips.map((clip) =>
      isLocalUploadSrc(clip.src) ? { ...clip, src: toLocalRenderSrc(clip.src) } : clip,
    ),
  };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = ClipsMontagePropsSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid render request.", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const props = await refreshS3ClipUrls(parsed.data);

  if (!isLambdaTarget()) {
    // RENDER_TARGET unset or "local" (the default): render on this machine
    // with the same headless-Chrome pipeline `remotion render` uses, and
    // save to out/. Meant for trying the app out before AWS Lambda is
    // deployed - see README "Deploying to AWS". This blocks until the
    // render finishes, so it can take a while for a full video.
    try {
      const { fileName } = await renderLocally(prepareClipsForLocalRender(props));
      return NextResponse.json({
        mode: "local",
        downloadUrl: `/api/render/download?mode=local&file=${encodeURIComponent(fileName)}`,
      });
    } catch (error) {
      console.error("Local render failed", error);
      return NextResponse.json({ error: "Local render failed." }, { status: 500 });
    }
  }

  // RENDER_TARGET=lambda: production path, output lands in S3.
  try {
    const { renderId, bucketName } = await startRender(props);
    return NextResponse.json({ mode: "lambda", renderId, bucketName });
  } catch (error) {
    console.error("Failed to start render", error);
    return NextResponse.json({ error: "Failed to start render." }, { status: 502 });
  }
}
