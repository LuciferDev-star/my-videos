import { NextResponse } from "next/server";
import { ClipsMontagePropsSchema } from "../../../../lib/remotion-schema";
import type { ClipsMontageProps } from "../../../../lib/remotion-schema";
import { presignGet } from "../../../../lib/aws/presign";
import { startRender } from "../../../../lib/aws/lambda-render";
import { startLocalRenderJob } from "../../../../lib/render/local-jobs";
import { isLocalUploadSrc, toLocalRenderSrc } from "../../../../lib/local-clips";
import { isS3SourceEnabled } from "../../../../lib/source-storage";

const RENDER_URL_EXPIRY_SECONDS = 60 * 60 * 6;

function isLambdaTarget(): boolean {
  return process.env.RENDER_TARGET === "lambda";
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

async function refreshS3ClipUrls(props: ClipsMontageProps): Promise<ClipsMontageProps> {
  const bucket = process.env.SOURCE_CLIPS_BUCKET;
  const region = process.env.SOURCE_CLIPS_REGION;

  if (!isS3SourceEnabled() || !bucket || !region) {
    return props;
  }

  const clips = await Promise.all(
    props.clips.map(async (clip) => {
      if (!clip.src.startsWith("http")) {
        return clip;
      }
      return {
        ...clip,
        src: await presignGet(region, bucket, clip.id, RENDER_URL_EXPIRY_SECONDS),
      };
    }),
  );

  return { ...props, clips };
}

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
    const renderId = startLocalRenderJob(prepareClipsForLocalRender(props));
    return NextResponse.json({
      mode: "local-job",
      renderId,
      bucketName: "local",
    });
  }

  try {
    const { renderId, bucketName } = await startRender(props);
    return NextResponse.json({ mode: "lambda", renderId, bucketName });
  } catch (error) {
    console.error("Failed to start render", error);
    return NextResponse.json(
      { error: errorMessage(error, "Failed to start render.") },
      { status: 502 },
    );
  }
}
