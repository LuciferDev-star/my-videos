import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { isSafeUploadKey, LOCAL_UPLOADS_DIR } from "../../../../lib/local-clips";
import { mimeTypeForFile } from "../../../../lib/video-extensions";

// Next.js production does not reliably serve files written to public/
// after the process starts, so browser previews go through this route
// instead of /uploads/<file>. Range requests are required for <video>.
export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key");
  if (!key || !isSafeUploadKey(key)) {
    return NextResponse.json({ error: "Invalid key." }, { status: 400 });
  }

  const filePath = path.join(LOCAL_UPLOADS_DIR, key);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const contentType = mimeTypeForFile(key);
  const rangeHeader = request.headers.get("range");

  if (rangeHeader) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);
    if (!match) {
      return new NextResponse(null, { status: 416 });
    }

    const start = match[1] ? Number(match[1]) : 0;
    const end = match[2] ? Number(match[2]) : fileSize - 1;
    if (start >= fileSize || end >= fileSize || start > end) {
      return new NextResponse(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${fileSize}` },
      });
    }

    const chunk = fs.readFileSync(filePath).subarray(start, end + 1);
    return new NextResponse(new Uint8Array(chunk), {
      status: 206,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(chunk.length),
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, no-store",
      },
    });
  }

  const data = fs.readFileSync(filePath);
  return new NextResponse(new Uint8Array(data), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(fileSize),
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, no-store",
    },
  });
}
