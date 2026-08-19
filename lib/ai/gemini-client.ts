import { GoogleGenAI } from "@google/genai";
import type { Content } from "@google/genai";

// Shared plumbing for every Gemini structured-JSON call in this app (prompt
// interpretation, transcription) - extracted after prompt-interpretation
// testing (see lib/ai/interpret-prompt.ts) turned up three real, repeatable
// Gemini reliability issues that any structured-output call site needs to
// handle the same way:
//   1. "-latest" model aliases, not pinned versions - some dated model
//      names 404 ("no longer available to new users") for newer API keys
//      even though they're still listed in ListModels.
//   2. Transient 503 "high demand" errors at a real, non-negligible rate
//      (~1 in 3 observed for the primary model) - worth retrying several
//      times before falling back to a second, less capable but more
//      available model.
//   3. The model can stop before finishing the JSON (either hitting
//      maxOutputTokens or just stopping early) - also worth one retry
//      rather than surfacing a raw parse error.
//
// NOT handled here, because it's schema-specific: whenever a response
// schema has a NUMBER field whose true value can be 0, the model
// reproducibly degenerates into an endless run of zeros until it hits
// maxOutputTokens (observed firsthand). Every schema passed to
// callGeminiJson must use INTEGER instead of NUMBER for such fields, and
// should make every field required with an explicit not-applicable
// placeholder rather than leaving fields optional (optional fields were
// observed being silently dropped far more often than they should).

const MODELS = ["gemini-flash-latest", "gemini-flash-lite-latest"] as const;
const ATTEMPTS_PER_MODEL = 3;
const RETRY_DELAY_MS = 1000;

class TruncatedResponseError extends Error {}

function isRetryable(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (/"status":"UNAVAILABLE"|"code":503/.test(error.message)) return true;
  return error instanceof TruncatedResponseError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function callGeminiJson({
  contents,
  systemInstruction,
  responseSchema,
  maxOutputTokens = 2048,
}: {
  contents: Content[];
  systemInstruction: string;
  responseSchema: object;
  maxOutputTokens?: number;
}): Promise<unknown> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const attempts = MODELS.flatMap((model) => Array(ATTEMPTS_PER_MODEL).fill(model));

  const generate = (model: string) =>
    ai.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema,
        // This is structured extraction, not a task that benefits from
        // extended reasoning - with thinking left at its default, testing
        // hit multi-minute responses and once a ~65KB reply truncated
        // mid-JSON (thinking tokens eating the output budget). The lite
        // model rejects thinkingConfig outright (400 INVALID_ARGUMENT) -
        // it has no thinking to disable, so only send this for models that
        // support it.
        ...(model.includes("lite") ? {} : { thinkingConfig: { thinkingBudget: 0 } }),
        maxOutputTokens,
      },
    });

  async function generateWithRetry(index: number): Promise<Awaited<ReturnType<typeof generate>>> {
    try {
      const result = await generate(attempts[index]);
      if (result.candidates?.[0]?.finishReason === "MAX_TOKENS") {
        throw new TruncatedResponseError("Gemini's response hit the output token limit.");
      }
      return result;
    } catch (error) {
      const isLastAttempt = index === attempts.length - 1;
      if (isLastAttempt || !isRetryable(error)) {
        throw error;
      }
      await sleep(RETRY_DELAY_MS);
      return generateWithRetry(index + 1);
    }
  }

  const response = await generateWithRetry(0);
  const text = response.text;
  if (!text) {
    throw new Error("Gemini returned an empty response.");
  }

  try {
    return JSON.parse(text);
  } catch {
    // Not retried here - the finishReason check above already retries the
    // known truncation case. A parse failure on a STOP-finished response
    // means the model produced something the schema shouldn't allow, not a
    // transient issue - fail clearly instead of silently returning nothing.
    throw new Error("Gemini's response wasn't valid JSON.");
  }
}
