import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { presignGet } from "../../../../lib/aws/presign";
import { LOCAL_OUTPUT_DIR } from "../../../../lib/render/local-render";

const DOWNLOAD_URL_EXPIRY_SECONDS = 60 * 60; // 1 hour

function isSafeLocalFileName(fileName: string): boolean {
  // No path separators or ".." - the file must resolve to a direct child of
  // out/, never allowing escape to an arbitrary path on disk.
  return /^[a-zA-Z0-9._-]+\.mp4$/.test(fileName);
}

function streamLocalFile(fileName: string): NextResponse | Response {
  if (!isSafeLocalFileName(fileName)) {
    return NextResponse.json({ error: "Invalid file name." }, { status: 400 });
  }

  const filePath = path.join(LOCAL_OUTPUT_DIR, fileName);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "Render output not found." }, { status: 404 });
  }

  const stat = fs.statSync(filePath);
  const webStream = Readable.toWeb(fs.createReadStream(filePath)) as ReadableStream;

  return new Response(webStream, {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(stat.size),
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode");

  if (mode === "local") {
    const file = searchParams.get("file");
    if (!file) {
      return NextResponse.json({ error: "file query param is required." }, { status: 400 });
    }
    return streamLocalFile(file);
  }

  const region = process.env.REMOTION_REGION;
  const bucketName = searchParams.get("bucketName");
  const outKey = searchParams.get("outKey");

  if (!region) {
    return NextResponse.json({ error: "REMOTION_REGION must be configured." }, { status: 500 });
  }

  if (!bucketName || !outKey) {
    return NextResponse.json(
      { error: "bucketName and outKey query params are required." },
      { status: 400 },
    );
  }

  try {
    const url = await presignGet(region, bucketName, outKey, DOWNLOAD_URL_EXPIRY_SECONDS);
    return NextResponse.json({ url });
  } catch (error) {
    console.error("Failed to presign download URL", error);
    return NextResponse.json({ error: "Failed to presign download URL." }, { status: 502 });
  }
}
