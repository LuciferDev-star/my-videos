import { Type } from "@google/genai";
import { callGeminiJson } from "./gemini-client";
import type { TranscriptCaption } from "../remotion-schema";

// Server-only: turns a clip's audio into speech-synced captions via Gemini,
// called from app/api/ai/transcribe-clip/route.ts whenever a clip is added
// to the editor timeline. Uses the same retry/model-fallback plumbing as
// lib/ai/interpret-prompt.ts for the generateContent call itself (see
// ./gemini-client.ts).
//
// Sends the clip as inline base64 data rather than via the Gemini Files
// API - the Files API's upload step itself works fine, but referencing an
// uploaded file from generateContent returned a reproducible 403
// PERMISSION_DENIED with this project's API key (confirmed by isolating
// the two calls directly against the API). Inline data has no such
// restriction and these are short, small AI-generated clips (hundreds of
// KB to a few MB observed) - comfortably under the ~20MB inline request
// limit, so there's no real downside here.

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    captions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          text: { type: Type.STRING },
          // INTEGER, not NUMBER - see gemini-client.ts's header comment on
          // why a NUMBER field whose true value can be 0 (the very first
          // caption starts at 0ms) reproducibly breaks this model.
          startMs: {
            type: Type.INTEGER,
            description: "Milliseconds from the very start of the clip.",
          },
          endMs: {
            type: Type.INTEGER,
            description: "Milliseconds from the very start of the clip.",
          },
        },
        required: ["text", "startMs", "endMs"],
      },
    },
  },
  required: ["captions"],
};

const SYSTEM_INSTRUCTION = `Transcribe all spoken words in this clip's audio, in order, as short natural phrases of about 1-4 words each - not single long sentences - since this is for subtitle display that should switch frequently in sync with speech.

Rules:
- startMs/endMs are milliseconds from the very start of the clip (0 = the first frame), not wall-clock time.
- Phrases must be in chronological order and must not overlap.
- Skip silence, music-only sections, and non-speech sound - only transcribe actual spoken words.
- If there is no speech at all, return an empty captions array.`;

const MAX_OUTPUT_TOKENS = 8192;

export async function transcribeClip(bytes: Buffer, mimeType: string): Promise<TranscriptCaption[]> {
  const parsed = (await callGeminiJson({
    contents: [
      {
        role: "user",
        parts: [{ inlineData: { data: bytes.toString("base64"), mimeType } }],
      },
    ],
    systemInstruction: SYSTEM_INSTRUCTION,
    responseSchema: RESPONSE_SCHEMA,
    maxOutputTokens: MAX_OUTPUT_TOKENS,
  })) as { captions: { text: string; startMs: number; endMs: number }[] };

  return (parsed.captions ?? []).map((caption) => ({
    text: caption.text,
    startMs: caption.startMs,
    endMs: caption.endMs,
    timestampMs: null,
    confidence: null,
  }));
}
