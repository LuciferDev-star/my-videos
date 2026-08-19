import { NextResponse } from "next/server";
import { z } from "zod";
import { ClipSchema } from "../../../../lib/remotion-schema";
import { parsePromptCommands } from "../../../../app/editor/parseCommand";
import { interpretPrompt } from "../../../../lib/ai/interpret-prompt";

const RequestSchema = z.object({
  prompt: z.string(),
  clips: z.array(ClipSchema),
});

// GEMINI_API_KEY set -> understand free-form natural language via Gemini
// (lib/ai/interpret-prompt.ts). Unset -> fall back to the deterministic
// fixed-phrasing matcher (app/editor/parseCommand.ts) so the prompt box
// still works with zero AI setup, same fallback pattern as RENDER_TARGET
// and SOURCE_CLIPS_BUCKET elsewhere in this app.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = RequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid prompt request.", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { prompt, clips } = parsed.data;

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ ...parsePromptCommands(prompt, clips), mode: "deterministic" });
  }

  try {
    const result = await interpretPrompt(prompt, clips);
    return NextResponse.json({ ...result, mode: "gemini" });
  } catch (error) {
    console.error("Gemini prompt interpretation failed", error);
    return NextResponse.json(
      { error: "Failed to interpret the prompt with Gemini." },
      { status: 502 },
    );
  }
}
