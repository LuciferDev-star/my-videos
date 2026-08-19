import { NextResponse } from "next/server";
import { isSafeUploadKey, saveLocalClip } from "../../../../lib/local-clips";

// Counterpart to a presigned S3 PUT, but for the local-disk fallback (see
// lib/local-clips.ts): the client PUTs the raw file body here the same way
// it would PUT to a presigned S3 URL, so UploadDropzone.tsx needs no
// branching between the two modes.
export async function PUT(request: Request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key");

  if (!key || !isSafeUploadKey(key)) {
    return NextResponse.json({ error: "Invalid key." }, { status: 400 });
  }

  try {
    const arrayBuffer = await request.arrayBuffer();
    saveLocalClip(key, Buffer.from(arrayBuffer));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to save local upload", error);
    return NextResponse.json({ error: "Failed to save upload." }, { status: 500 });
  }
}
