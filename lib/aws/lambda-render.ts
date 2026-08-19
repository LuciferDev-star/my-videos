import {
  getRenderProgress,
  renderMediaOnLambda,
  type AwsRegion,
  type RenderProgress,
} from "@remotion/lambda/client";
import type { ClipsMontageProps } from "../remotion-schema";

function getLambdaConfig() {
  const region = process.env.REMOTION_REGION as AwsRegion | undefined;
  const functionName = process.env.REMOTION_FUNCTION_NAME;
  const serveUrl = process.env.REMOTION_SERVE_URL;

  if (!region || !functionName || !serveUrl) {
    throw new Error(
      "Missing Remotion Lambda configuration: set REMOTION_REGION, REMOTION_FUNCTION_NAME and REMOTION_SERVE_URL.",
    );
  }

  return { region, functionName, serveUrl };
}

export async function startRender(
  inputProps: ClipsMontageProps,
): Promise<{ renderId: string; bucketName: string }> {
  const { region, functionName, serveUrl } = getLambdaConfig();

  const { renderId, bucketName } = await renderMediaOnLambda({
    region,
    functionName,
    serveUrl,
    composition: "ClipsMontage",
    inputProps,
    codec: "h264",
    privacy: "private",
    downloadBehavior: { type: "download", fileName: "final-video.mp4" },
  });

  return { renderId, bucketName };
}

export async function checkRenderProgress(
  renderId: string,
  bucketName: string,
): Promise<RenderProgress> {
  const { region, functionName } = getLambdaConfig();

  return getRenderProgress({ renderId, bucketName, functionName, region });
}
