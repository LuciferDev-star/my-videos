import { useCallback, useEffect, useMemo, useState } from "react";
import { AbsoluteFill, Sequence, staticFile, useDelayRender, useVideoConfig } from "remotion";
import { createTikTokStyleCaptions } from "@remotion/captions";
import type { Caption, TikTokPage } from "@remotion/captions";
import { CaptionPage } from "./CaptionPage";

const SWITCH_CAPTIONS_EVERY_MS = 1500;

export const CaptionsOverlay: React.FC<{ captionsFile: string }> = ({
  captionsFile,
}) => {
  const { fps } = useVideoConfig();
  const [captionGroups, setCaptionGroups] = useState<Caption[][] | null>(
    null,
  );
  const { delayRender, continueRender, cancelRender } = useDelayRender();
  const [handle] = useState(() => delayRender());

  const fetchCaptions = useCallback(async () => {
    try {
      const response = await fetch(staticFile(captionsFile));
      const data = await response.json();
      setCaptionGroups(data);
      continueRender(handle);
    } catch (e) {
      cancelRender(e);
    }
  }, [continueRender, cancelRender, handle, captionsFile]);

  useEffect(() => {
    fetchCaptions();
  }, [fetchCaptions]);

  // Each clip's tokens are paginated in isolation, then concatenated - this
  // guarantees a page never combines dialogue from two different clips, even
  // when the gap between them is under the combine-tokens time window.
  const pages = useMemo(() => {
    if (!captionGroups) {
      return [] as TikTokPage[];
    }
    return captionGroups.flatMap(
      (captions) =>
        createTikTokStyleCaptions({
          captions,
          combineTokensWithinMilliseconds: SWITCH_CAPTIONS_EVERY_MS,
        }).pages,
    );
  }, [captionGroups]);

  if (!captionGroups) {
    return null;
  }

  return (
    <AbsoluteFill>
      {pages.map((page, index) => {
        const nextPage = pages[index + 1] ?? null;
        const startFrame = (page.startMs / 1000) * fps;
        const endFrame = Math.min(
          nextPage ? (nextPage.startMs / 1000) * fps : Infinity,
          startFrame + (SWITCH_CAPTIONS_EVERY_MS / 1000) * fps,
        );
        const durationInFrames = endFrame - startFrame;

        if (durationInFrames <= 0) {
          return null;
        }

        return (
          <Sequence
            key={index}
            from={Math.round(startFrame)}
            durationInFrames={Math.round(durationInFrames)}
            layout="none"
          >
            <CaptionPage text={page.text} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
