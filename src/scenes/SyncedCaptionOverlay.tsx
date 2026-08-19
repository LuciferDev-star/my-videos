import { useMemo } from "react";
import { AbsoluteFill, Sequence, useVideoConfig } from "remotion";
import type { Caption } from "@remotion/captions";
import { CaptionPage } from "./CaptionPage";

// Speech-synced captions for a single clip, auto-transcribed by Gemini (see
// lib/ai/transcribe-clip.ts) when the clip is added to the timeline. Each
// entry is already a short natural phrase (Gemini is instructed to produce
// ~1-4 word phrases directly, unlike word-by-word Whisper output) - so
// unlike the legacy CaptionsOverlay.tsx, there's no TikTok-style
// combine/paginate step here: merging these phrases further and capping
// their display at a fixed switch interval (as CaptionsOverlay does for
// single-word tokens) was tried first and caused later phrases in a clip
// to never get their own visible time at all, since a merged page's
// display window was capped well short of covering all its own content.
// Each phrase is rendered for exactly its own [startMs, endMs) window.
//
// `captions` timestamps are in the clip's own source-relative time (0 = the
// very start of the original file, before any trim) - this component
// filters to what's actually visible after the current trim and shifts
// timestamps so they line up with frame 0 of the parent
// TransitionSeries.Sequence in ClipsMontage.tsx, the same way
// `<Video trimBefore>` already shifts the video track. Rendered instead of
// this when `captionText` is set (see ClipsMontage.tsx) - a manual caption
// always wins over the auto-generated one.
export const SyncedCaptionOverlay: React.FC<{
  captions: Caption[];
  trimBeforeSeconds: number;
  trimAfterSeconds: number;
}> = ({ captions, trimBeforeSeconds, trimAfterSeconds }) => {
  const { fps } = useVideoConfig();
  const trimBeforeMs = trimBeforeSeconds * 1000;
  const trimAfterMs = trimAfterSeconds * 1000;

  const visibleCaptions = useMemo(() => {
    return captions
      .filter((caption) => caption.endMs > trimBeforeMs && caption.startMs < trimAfterMs)
      .map((caption) => ({
        ...caption,
        startMs: Math.max(0, caption.startMs - trimBeforeMs),
        endMs: Math.min(trimAfterMs, caption.endMs) - trimBeforeMs,
      }));
  }, [captions, trimBeforeMs, trimAfterMs]);

  return (
    <AbsoluteFill>
      {visibleCaptions.map((caption, index) => {
        const startFrame = Math.round((caption.startMs / 1000) * fps);
        const endFrame = Math.round((caption.endMs / 1000) * fps);
        const durationInFrames = endFrame - startFrame;

        if (durationInFrames <= 0) {
          return null;
        }

        return (
          <Sequence key={index} from={startFrame} durationInFrames={durationInFrames} layout="none">
            <CaptionPage text={caption.text} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
