import { NextResponse } from "next/server";
import { checkRenderProgress } from "../../../../lib/aws/lambda-render";
import { getLocalRenderJob } from "../../../../lib/render/local-jobs";

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

  if (bucketName === "local") {
    const job = getLocalRenderJob(renderId);
    if (!job) {
      return NextResponse.json({ error: "Render job not found." }, { status: 404 });
    }

    return NextResponse.json({
      done: job.status === "done",
      overallProgress: job.overallProgress,
      outKey: job.fileName ?? null,
      errors: job.error ? [{ message: job.error }] : [],
      fatalErrorEncountered: job.status === "error",
    });
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
