import type { Action, EditorClip } from "./useEditorState";

// Turns a typed prompt into edit actions WITHOUT any AI/LLM - this matches a
// fixed set of instruction patterns deterministically (regex, in-process,
// zero cost/latency/external calls). It is not free-form natural-language
// understanding: an instruction either matches one of these shapes or it
// doesn't, and unmatched lines are reported back so the editor can adjust
// the wording rather than silently doing nothing.
//
// Used directly when GEMINI_API_KEY isn't set, and as the validation layer
// (clipAt/noSuchClip below) reused by the Gemini path when it is - see
// app/api/ai/interpret-prompt/route.ts and lib/ai/interpret-prompt.ts.
export type ParsedCommand = Exclude<Action, { type: "ADD_CLIP" }>;

export type ParseError = { line: string; reason: string };

export type ParseResult = {
  commands: ParsedCommand[];
  errors: ParseError[];
};

export const PROMPT_EXAMPLES = [
  "trim clip 2 to 0-5s",
  "caption clip 1: Welcome to the app",
  "remove caption from clip 3",
  "transition clip 2 hard cut",
  "transition clip 2 crossfade",
  "move clip 4 up",
  "remove clip 5",
];

export function clipAt(clips: EditorClip[], position: number): EditorClip | null {
  if (!Number.isInteger(position) || position < 1 || position > clips.length) {
    return null;
  }
  return clips[position - 1];
}

export type LineResult = { command: ParsedCommand } | { reason: string };

export function noSuchClip(position: number | string): LineResult {
  return { reason: `No clip ${position} in the timeline.` };
}

function parseLine(line: string, clips: EditorClip[]): LineResult {
  let match: RegExpExecArray | null;

  if ((match = /^(?:remove|delete)\s+clip\s+(\d+)$/i.exec(line))) {
    const clip = clipAt(clips, Number(match[1]));
    if (!clip) return noSuchClip(match[1]);
    return { command: { type: "REMOVE_CLIP", id: clip.id } };
  }

  if ((match = /^move\s+clip\s+(\d+)\s+(up|down)$/i.exec(line))) {
    const clip = clipAt(clips, Number(match[1]));
    if (!clip) return noSuchClip(match[1]);
    return {
      command: {
        type: "MOVE_CLIP",
        id: clip.id,
        direction: match[2].toLowerCase() as "up" | "down",
      },
    };
  }

  if (
    (match =
      /^trim\s+clip\s+(\d+)\s+(?:(?:to|from)\s+)?(\d+(?:\.\d+)?)\s*s?\s*(?:-|to)\s*(\d+(?:\.\d+)?)\s*s?$/i.exec(
        line,
      ))
  ) {
    const clip = clipAt(clips, Number(match[1]));
    if (!clip) return noSuchClip(match[1]);
    const start = Number(match[2]);
    const end = Number(match[3]);
    if (end <= start) {
      return { reason: `End time must be after start time ("${line}").` };
    }
    // Reject rather than silently clamp - the editor typed a specific
    // number and should know it didn't take effect, not get a different
    // number than what they asked for with no explanation.
    if (
      clip.sourceDurationSeconds !== undefined &&
      end > clip.sourceDurationSeconds
    ) {
      return {
        reason: `Clip ${match[1]} is only ${clip.sourceDurationSeconds.toFixed(1)}s long - can't trim to ${end}s.`,
      };
    }
    return {
      command: {
        type: "SET_TRIM",
        id: clip.id,
        trimBeforeSeconds: start,
        trimAfterSeconds: end,
      },
    };
  }

  if ((match = /^caption\s+clip\s+(\d+)\s*:\s*(.+)$/i.exec(line))) {
    const clip = clipAt(clips, Number(match[1]));
    if (!clip) return noSuchClip(match[1]);
    return { command: { type: "SET_CAPTION", id: clip.id, captionText: match[2].trim() } };
  }

  if ((match = /^add\s+caption\s+"?([^"]+?)"?\s+to\s+clip\s+(\d+)$/i.exec(line))) {
    const clip = clipAt(clips, Number(match[2]));
    if (!clip) return noSuchClip(match[2]);
    return { command: { type: "SET_CAPTION", id: clip.id, captionText: match[1].trim() } };
  }

  if ((match = /^remove\s+caption\s+(?:from\s+)?clip\s+(\d+)$/i.exec(line))) {
    const clip = clipAt(clips, Number(match[1]));
    if (!clip) return noSuchClip(match[1]);
    return { command: { type: "SET_CAPTION", id: clip.id, captionText: "" } };
  }

  if ((match = /^transition\s+clip\s+(\d+)\s+(hard cut|crossfade|cut|fade)$/i.exec(line))) {
    const clip = clipAt(clips, Number(match[1]));
    if (!clip) return noSuchClip(match[1]);
    return {
      command: {
        type: "SET_TRANSITION",
        id: clip.id,
        transitionAfter: match[2].toLowerCase().includes("cut") ? "none" : "fade",
      },
    };
  }

  if ((match = /^(hard cut|crossfade)\s+after\s+clip\s+(\d+)$/i.exec(line))) {
    const clip = clipAt(clips, Number(match[2]));
    if (!clip) return noSuchClip(match[2]);
    return {
      command: {
        type: "SET_TRANSITION",
        id: clip.id,
        transitionAfter: match[1].toLowerCase() === "hard cut" ? "none" : "fade",
      },
    };
  }

  return { reason: `Didn't understand "${line}".` };
}

export function parsePromptCommands(prompt: string, clips: EditorClip[]): ParseResult {
  const lines = prompt
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const commands: ParsedCommand[] = [];
  const errors: ParseError[] = [];

  for (const line of lines) {
    const result = parseLine(line, clips);
    if ("command" in result) {
      commands.push(result.command);
    } else {
      errors.push({ line, reason: result.reason });
    }
  }

  return { commands, errors };
}
