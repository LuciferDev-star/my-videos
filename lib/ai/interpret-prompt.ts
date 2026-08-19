import { Type } from "@google/genai";
import { clipAt, noSuchClip } from "../../app/editor/parseCommand";
import type { ParsedCommand, ParseError, ParseResult } from "../../app/editor/parseCommand";
import type { EditorClip } from "../../app/editor/useEditorState";
import { clampTrimRange } from "../remotion-schema";
import { callGeminiJson } from "./gemini-client";

// Server-only: the Gemini-understood counterpart to app/editor/parseCommand.ts's
// deterministic regex matcher. Used when GEMINI_API_KEY is set (see
// app/api/ai/interpret-prompt/route.ts) so the prompt box can understand
// open-ended free text instead of only the fixed phrasings. Deliberately
// scoped the same as the regex parser - edits to clips already on the
// timeline only (no picking/adding clips from the bucket by description).
// The retry/model-fallback plumbing (and the reliability lessons behind it)
// live in ./gemini-client.ts, shared with lib/ai/transcribe-clip.ts.

const INTENT_TYPES = ["remove", "move", "trim", "caption", "transition"] as const;
type IntentType = (typeof INTENT_TYPES)[number];

// What Gemini fills in - clips are referenced by 1-based timeline position
// (the same numbering shown to the user in the timeline/prompt examples),
// never by internal id, so the model never has to invent or echo back an id.
//
// Every field is required in the schema below, even though only some apply
// to any given intent type - testing found that leaving fields optional
// made the model silently drop them (e.g. emit a "trim" with
// trimStartSeconds but no trimEndSeconds, or skip later instructions in a
// multi-part prompt entirely) far more often than it should. Forcing every
// field present, with "none"/0/"" as the not-applicable placeholder, fixed
// both failure modes in testing. resolveIntent() below only reads the
// fields relevant to intent.type, so the placeholders on irrelevant fields
// are simply ignored.
type Intent = {
  type: IntentType;
  clipPosition: number;
  direction: "up" | "down" | "none";
  trimStartSeconds: number;
  trimEndSeconds: number;
  captionText: string;
  transition: "cut" | "crossfade" | "none";
};

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    intents: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING, enum: [...INTENT_TYPES] },
          clipPosition: {
            type: Type.INTEGER,
            description: "1-based position of the clip in the timeline this instruction applies to.",
          },
          direction: {
            type: Type.STRING,
            enum: ["up", "down", "none"],
            description: "Only for type=move. \"none\" otherwise.",
          },
          // INTEGER, not NUMBER: whenever the true value is exactly 0, this
          // model reproducibly degenerates into an endless run of zeros in
          // scientific notation for a NUMBER-typed field (observed
          // firsthand - "0.000...e-50000...", truncated only by hitting
          // maxOutputTokens) until finishReason is MAX_TOKENS and the JSON
          // never closes. INTEGER doesn't hit this failure mode. Trade-off:
          // whole-second trim precision only from the prompt box - matches
          // how people actually phrase trims in natural language, and the
          // guided per-clip editor (ClipEditPanel) still allows fractional
          // trims when finer control is needed.
          trimStartSeconds: {
            type: Type.INTEGER,
            description: "Only for type=trim. 0 otherwise.",
          },
          trimEndSeconds: {
            type: Type.INTEGER,
            description: "Only for type=trim. 0 otherwise.",
          },
          captionText: {
            type: Type.STRING,
            description:
              "Only for type=caption. Empty string means remove the caption (or: not applicable to this intent type).",
          },
          transition: {
            type: Type.STRING,
            enum: ["cut", "crossfade", "none"],
            description: "Only for type=transition. \"none\" otherwise.",
          },
        },
        required: [
          "type",
          "clipPosition",
          "direction",
          "trimStartSeconds",
          "trimEndSeconds",
          "captionText",
          "transition",
        ],
        propertyOrdering: [
          "type",
          "clipPosition",
          "trimStartSeconds",
          "trimEndSeconds",
          "captionText",
          "transition",
          "direction",
        ],
      },
    },
  },
  required: ["intents"],
};

function describeTimeline(clips: EditorClip[]): string {
  return clips
    .map((clip, index) => {
      const position = index + 1;
      const duration =
        clip.sourceDurationSeconds !== undefined
          ? `${clip.sourceDurationSeconds.toFixed(1)}s total`
          : "unknown length";
      const trim = `currently trimmed to ${clip.trimBeforeSeconds}s-${clip.trimAfterSeconds}s`;
      const caption = clip.captionText ? `caption: "${clip.captionText}"` : "no caption";
      const transition = `transition after: ${clip.transitionAfter}`;
      const label = clip.label ? ` "${clip.label}"` : "";
      return `${position}.${label} (${duration}, ${trim}, ${caption}, ${transition})`;
    })
    .join("\n");
}

const SYSTEM_INSTRUCTION = `You turn a video editor's free-form instructions into a structured list of edit intents.

Rules:
- Extract EVERY distinct edit the user asked for, even when several are packed into one sentence - do not stop after the first one. If the user asks for nothing actionable, return an empty intents array.
- Reference clips by their 1-based position in the timeline given to you. If the user's wording implies a clip position outside that range (e.g. "remove clip 5" when only 2 are listed), still emit the intent with that position rather than silently skipping it - the app will report a clear "no such clip" error back to the user, which is better than the instruction being silently ignored.
- "remove"/"delete" a clip -> type "remove".
- Reorder a clip up/down one position -> type "move" with direction "up" or "down".
- Trim/cut a clip to a time range -> type "trim" with BOTH trimStartSeconds and trimEndSeconds (seconds from the start of the clip's own source, not the timeline). "the first N seconds" means trimStartSeconds 0 and trimEndSeconds N. Never emit a trim intent with only one of the two times.
- Set/change/add a caption -> type "caption" with captionText. Remove a caption -> type "caption" with captionText set to "".
- Hard cut / no transition / cut directly -> type "transition" with transition "cut". Crossfade / fade / smooth transition -> type "transition" with transition "crossfade". This describes the transition AFTER the given clip.
- Every field must be present on every intent, even fields that don't apply to that intent's type. Fill fields that don't apply with their not-applicable placeholder: direction "none", trimStartSeconds 0, trimEndSeconds 0, captionText "", transition "none". Never leave a field out.

Example - given a 2-clip timeline, the instruction "Make the first clip just the first five seconds, and get rid of the caption on the second clip. Also make the transition after clip 1 a hard cut instead of a fade." must produce all three of:
{"intents":[
  {"type":"trim","clipPosition":1,"direction":"none","trimStartSeconds":0,"trimEndSeconds":5,"captionText":"","transition":"none"},
  {"type":"caption","clipPosition":2,"direction":"none","trimStartSeconds":0,"trimEndSeconds":0,"captionText":"","transition":"none"},
  {"type":"transition","clipPosition":1,"direction":"none","trimStartSeconds":0,"trimEndSeconds":0,"captionText":"","transition":"cut"}
]}`;

// Human-readable rendering of an intent for error messages, matching the
// phrasing style of the deterministic parser's PROMPT_EXAMPLES (e.g. "trim
// clip 2 to 0-5s") rather than dumping the raw JSON Gemini returned.
function describeIntent(intent: Intent): string {
  switch (intent.type) {
    case "remove":
      return `remove clip ${intent.clipPosition}`;
    case "move":
      return `move clip ${intent.clipPosition} ${intent.direction}`;
    case "trim":
      return `trim clip ${intent.clipPosition} to ${intent.trimStartSeconds}-${intent.trimEndSeconds}s`;
    case "caption":
      return intent.captionText
        ? `caption clip ${intent.clipPosition}: ${intent.captionText}`
        : `remove caption from clip ${intent.clipPosition}`;
    case "transition":
      return `transition clip ${intent.clipPosition} ${intent.transition}`;
    default:
      return JSON.stringify(intent);
  }
}

function resolveIntent(intent: Intent, clips: EditorClip[]): { command: ParsedCommand } | { line: string; reason: string } {
  const describe = () => describeIntent(intent);
  const clip = clipAt(clips, intent.clipPosition);

  if (!clip) {
    const result = noSuchClip(intent.clipPosition);
    return {
      line: describe(),
      reason: "reason" in result ? result.reason : `No clip ${intent.clipPosition} in the timeline.`,
    };
  }

  switch (intent.type) {
    case "remove":
      return { command: { type: "REMOVE_CLIP", id: clip.id } };

    case "move":
      if (intent.direction !== "up" && intent.direction !== "down") {
        return { line: describe(), reason: "Move instruction is missing a direction." };
      }
      return { command: { type: "MOVE_CLIP", id: clip.id, direction: intent.direction } };

    case "trim": {
      if (intent.trimStartSeconds === undefined || intent.trimEndSeconds === undefined) {
        return { line: describe(), reason: "Trim instruction is missing a start or end time." };
      }
      if (intent.trimEndSeconds <= intent.trimStartSeconds) {
        return {
          line: describe(),
          reason: `End time must be after start time for clip ${intent.clipPosition}.`,
        };
      }
      if (
        clip.sourceDurationSeconds !== undefined &&
        intent.trimEndSeconds > clip.sourceDurationSeconds
      ) {
        return {
          line: describe(),
          reason: `Clip ${intent.clipPosition} is only ${clip.sourceDurationSeconds.toFixed(1)}s long - can't trim to ${intent.trimEndSeconds}s.`,
        };
      }
      const { trimBeforeSeconds, trimAfterSeconds } = clampTrimRange(
        clip.sourceDurationSeconds,
        intent.trimStartSeconds,
        intent.trimEndSeconds,
      );
      return {
        command: { type: "SET_TRIM", id: clip.id, trimBeforeSeconds, trimAfterSeconds },
      };
    }

    case "caption":
      if (intent.captionText === undefined) {
        return { line: describe(), reason: "Caption instruction is missing text." };
      }
      return { command: { type: "SET_CAPTION", id: clip.id, captionText: intent.captionText } };

    case "transition":
      if (intent.transition !== "cut" && intent.transition !== "crossfade") {
        return { line: describe(), reason: "Transition instruction is missing a style." };
      }
      return {
        command: {
          type: "SET_TRANSITION",
          id: clip.id,
          transitionAfter: intent.transition === "cut" ? "none" : "fade",
        },
      };

    default:
      return { line: describe(), reason: `Unknown instruction type "${intent.type}".` };
  }
}

export async function interpretPrompt(prompt: string, clips: EditorClip[]): Promise<ParseResult> {
  const parsed = (await callGeminiJson({
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `Timeline (${clips.length} clip${clips.length === 1 ? "" : "s"}):\n${describeTimeline(clips)}\n\nInstructions:\n${prompt}`,
          },
        ],
      },
    ],
    systemInstruction: SYSTEM_INSTRUCTION,
    responseSchema: RESPONSE_SCHEMA,
  })) as { intents: Intent[] };

  const commands: ParsedCommand[] = [];
  const errors: ParseError[] = [];

  for (const intent of parsed.intents ?? []) {
    const result = resolveIntent(intent, clips);
    if ("command" in result) {
      commands.push(result.command);
    } else {
      errors.push({ line: result.line, reason: result.reason });
    }
  }

  return { commands, errors };
}
