import { NextResponse } from "next/server";
import { transcribeClip } from "../../../../lib/ai/transcribe-clip";
import { isLocalUploadSrc, readLocalClip } from "../../../../lib/local-clips";
import { mimeTypeForFile } from "../../../../lib/video-extensions";

// Best-effort: transcription is a caption enhancement, not something adding
// a clip to the timeline should ever be blocked on. Every failure path here
// (no key, bad src, Gemini error) returns an empty captions array with a
// 200, not an error status - see app/components/editor/ClipBrowser.tsx,
// which fires this off after ADD_CLIP and just leaves the clip caption-less
// if it comes back empty.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const src = typeof body?.src === "string" ? body.src : null;

  if (!src) {
    return NextResponse.json({ error: "src is required." }, { status: 400 });
  }

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ captions: [] });
  }

  try {
    const bytes = isLocalUploadSrc(src)
      ? readLocalClip(src)
      : Buffer.from(await (await fetch(src)).arrayBuffer());
    const mimeType = mimeTypeForFile(src);

    const captions = await transcribeClip(bytes, mimeType);
    return NextResponse.json({ captions });
  } catch (error) {
    console.error("Clip transcription failed", error);
    return NextResponse.json({ captions: [] });
  }
}
