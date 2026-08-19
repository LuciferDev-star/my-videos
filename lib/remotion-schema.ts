import { z } from "zod";

// Shared contract between the Remotion composition (src/), the editor's
// live <Player> preview, and the render API. Keeping schema + duration math
// in one file (with zero dependency on the "remotion" package itself) is
// what lets this be imported safely from Next.js server API routes - "remotion"
// crashes when evaluated under Next's react-server bundling condition, so it
// must never be imported here. See src/defaultClipsMontageProps.ts for the
// one place that's allowed to call staticFile().

export const TRANSITION_CHOICES = ["fade", "none"] as const;
export const TransitionChoiceSchema = z.enum(TRANSITION_CHOICES);
export type TransitionChoice = z.infer<typeof TransitionChoiceSchema>;

// Mirrors @remotion/captions' `Caption` type field-for-field, but declared
// locally instead of imported - this file must never import "remotion" or
// "@remotion/*" packages (see header comment above), and the shape is
// simple enough to duplicate safely. src/scenes/SyncedCaptionOverlay.tsx
// (which does import @remotion/captions) treats this as structurally
// identical to Caption[].
export const TranscriptCaptionSchema = z.object({
  text: z.string(),
  startMs: z.number(),
  endMs: z.number(),
  timestampMs: z.number().nullable(),
  confidence: z.number().nullable(),
});
export type TranscriptCaption = z.infer<typeof TranscriptCaptionSchema>;

export const ClipSchema = z.object({
  // Stable UI key. When a clip comes from S3, this is the S3 object key.
  id: z.string(),
  // Either a staticFile() path (local/default) or a presigned S3 URL
  // (production). @remotion/media's <Video> accepts both, so no format
  // validation is enforced here.
  src: z.string().min(1),
  // Editor-facing display name only (not persisted back to S3).
  label: z.string().default(""),
  // The clip's actual full length, detected client-side from the <video>
  // element when it's added to the timeline (see ClipBrowser.tsx). Used to
  // validate/clamp trims against reality - without this, nothing stopped a
  // trim (typed or from the prompt box) from requesting more of the clip
  // than actually exists, which desyncs audio/video and leaves captions
  // pointing at content that was never there.
  sourceDurationSeconds: z.number().min(0).optional(),
  trimBeforeSeconds: z.number().min(0).default(0),
  trimAfterSeconds: z.number().min(0),
  // Transition rendered *after* this clip. Ignored on the last clip.
  transitionAfter: TransitionChoiceSchema.default("fade"),
  // Manually typed caption/text overlay for this clip only, shown for the
  // clip's entire on-screen duration. When set, this overrides `captions`
  // below (see ClipsMontage.tsx) - an explicit prompt/UI instruction wins
  // over the auto-generated transcript.
  captionText: z.string().optional(),
  // Auto-transcribed, speech-synced captions for this clip, in the clip's
  // own source-relative time (milliseconds from the start of the original
  // file, before any trim) - populated via Gemini transcription when the
  // clip is added to the timeline (see app/api/ai/transcribe-clip). Only
  // rendered when `captionText` isn't set.
  captions: z.array(TranscriptCaptionSchema).optional(),
});
export type Clip = z.infer<typeof ClipSchema>;
export type ClipInput = z.input<typeof ClipSchema>;

export const ClipsMontagePropsSchema = z.object({
  // "Up to 6 clips" is a guided-editor UI policy (see MAX_CLIPS in
  // app/editor/useEditorState.ts), not a rendering constraint - the legacy
  // default video below has 8 segments (7 source clips, one split in two
  // for a hard cut) and must keep rendering.
  clips: z.array(ClipSchema).min(1),
  transitionDurationInFrames: z.number().int().min(0).default(12),
  // Legacy whisper-derived captions file, only ever populated by the local
  // default props below - not settable from the guided editor UI.
  //
  // .default("") rather than .optional(): the "ClipsMontage" composition in
  // src/Root.tsx is registered with defaultProps from the legacy 7-clip
  // video (which does set a real captionsFile). Remotion resolves a
  // render's final props by filling in whatever the caller's inputProps
  // leaves out from those defaultProps - so any props object that simply
  // omits this key (as every editor/API-driven render always did) silently
  // inherited the legacy captions file and rendered its unrelated,
  // differently-timed captions on top of the actual clips. Confirmed
  // firsthand: passing captionsFile: "" through eliminated the leak;
  // .optional() alone did not, because an absent key still let the
  // fallback through. An explicit empty string is always present in the
  // parsed output, so it can never be silently backfilled.
  captionsFile: z.string().default(""),
});
export type ClipsMontageProps = z.infer<typeof ClipsMontagePropsSchema>;
export type ClipsMontagePropsInput = z.input<typeof ClipsMontagePropsSchema>;

export function toRenderProps(
  input: ClipsMontagePropsInput,
): ClipsMontageProps {
  return ClipsMontagePropsSchema.parse(input);
}

// Keeps a trim request inside what the clip actually contains. Used both as
// a last line of defense in the editor reducer (every entry point funnels
// through SET_TRIM) and, separately, by the prompt parser to detect and
// report an out-of-range request instead of silently clamping it.
export function clampTrimRange(
  sourceDurationSeconds: number | undefined,
  trimBeforeSeconds: number,
  trimAfterSeconds: number,
): { trimBeforeSeconds: number; trimAfterSeconds: number } {
  const before = Math.max(0, trimBeforeSeconds);
  const after =
    sourceDurationSeconds !== undefined
      ? Math.min(trimAfterSeconds, sourceDurationSeconds)
      : trimAfterSeconds;

  return { trimBeforeSeconds: Math.min(before, after), trimAfterSeconds: after };
}

export function calculateClipsMontageMetadata(
  props: ClipsMontageProps,
  fps: number,
): { durationInFrames: number } {
  let totalFrames = 0;

  props.clips.forEach((clip, index) => {
    const isLast = index === props.clips.length - 1;
    const clipFrames = Math.round(
      (clip.trimAfterSeconds - clip.trimBeforeSeconds) * fps,
    );
    totalFrames += clipFrames;

    if (!isLast && clip.transitionAfter === "fade") {
      totalFrames -= props.transitionDurationInFrames;
    }
  });

  return { durationInFrames: Math.max(totalFrames, 1) };
}
