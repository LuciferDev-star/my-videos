"use client";

import { Player } from "@remotion/player";
import { ClipsMontage } from "../../../src/scenes/ClipsMontage";
import { calculateClipsMontageMetadata } from "../../../lib/remotion-schema";
import type { ClipsMontageProps } from "../../../lib/remotion-schema";

const FPS = 24;
const WIDTH = 1080;
const HEIGHT = 1920;

// Bound to the exact same ClipsMontageProps object that /api/render/start
// receives, via calculateClipsMontageMetadata - so what the editor sees here
// is what actually gets rendered, never an approximation.
export function PreviewPlayer({
  renderProps,
}: {
  renderProps: ClipsMontageProps | null;
}) {
  if (!renderProps) {
    return (
      <div className="flex aspect-[9/16] w-full max-w-xs items-center justify-center rounded border border-dashed border-neutral-700 text-sm text-neutral-500">
        Add clips to see a preview
      </div>
    );
  }

  const { durationInFrames } = calculateClipsMontageMetadata(renderProps, FPS);

  return (
    <Player
      component={ClipsMontage}
      inputProps={renderProps}
      durationInFrames={durationInFrames}
      fps={FPS}
      compositionWidth={WIDTH}
      compositionHeight={HEIGHT}
      style={{ width: "100%", maxWidth: 320 }}
      controls
    />
  );
}
