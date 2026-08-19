import { NextResponse } from "next/server";
import { checkRenderProgress } from "../../../../lib/aws/lambda-render";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const renderId = searchParams.get("renderId");
  const bucketName = searchParams.get("bucketName");

  if (!renderId || !bucketName) {
    return NextResponse.json(
      { error: "renderId and bucketName query params are required." },
      { status: 400 },
    );
  }

  try {
    const progress = await checkRenderProgress(renderId, bucketName);

    return NextResponse.json({
      done: progress.done,
      overallProgress: progress.overallProgress,
      outputFile: progress.outputFile,
      outKey: progress.outKey,
      errors: progress.errors,
      fatalErrorEncountered: progress.fatalErrorEncountered,
    });
  } catch (error) {
    console.error("Failed to fetch render progress", error);
    return NextResponse.json({ error: "Failed to fetch render progress." }, { status: 502 });
  }
}
