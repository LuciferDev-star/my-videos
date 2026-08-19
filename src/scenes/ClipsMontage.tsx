import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { Video } from "@remotion/media";
import { CaptionsOverlay } from "./CaptionsOverlay";
import { ClipCaptionOverlay } from "./ClipCaptionOverlay";
import { SyncedCaptionOverlay } from "./SyncedCaptionOverlay";
import type { ClipsMontageProps } from "../../lib/remotion-schema";

// The clip list, trims, transitions and captions all come from props now
// (see lib/remotion-schema.ts) so this composition can be driven by the
// editor UI / Remotion Lambda renders as well as by Studio's own props
// panel. Always fully-resolved props - callers with no props of their own
// (e.g. MyVideo.tsx) pass getDefaultClipsMontageProps() explicitly rather
// than relying on an implicit fallback here.
export const ClipsMontage: React.FC<ClipsMontageProps> = ({
  clips,
  transitionDurationInFrames,
  captionsFile,
}) => {
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000" }}>
      <TransitionSeries>
        {clips.map((clip, index) => {
          const isLast = index === clips.length - 1;
          const trimBefore = Math.round(clip.trimBeforeSeconds * fps);
          const trimAfter = Math.round(clip.trimAfterSeconds * fps);

          return (
            <>
              <TransitionSeries.Sequence
                key={clip.id}
                durationInFrames={trimAfter - trimBefore}
                name={`Clip ${index + 1} - ${clip.label}`}
              >
                <Video
                  name={`Clip ${index + 1} footage`}
                  src={clip.src}
                  trimBefore={trimBefore}
                  trimAfter={trimAfter}
                  objectFit="cover"
                  style={{ width: "100%", height: "100%" }}
                />
                {clip.captionText ? (
                  <ClipCaptionOverlay text={clip.captionText} />
                ) : (
                  clip.captions &&
                  clip.captions.length > 0 && (
                    <SyncedCaptionOverlay
                      captions={clip.captions}
                      trimBeforeSeconds={clip.trimBeforeSeconds}
                      trimAfterSeconds={clip.trimAfterSeconds}
                    />
                  )
                )}
              </TransitionSeries.Sequence>
              {/* No transition after a clip marked "none" (e.g. a hard cut
                  over an internal duplicate) or after the final sequence. */}
              {!isLast && clip.transitionAfter === "fade" && (
                <TransitionSeries.Transition
                  key={`${clip.id}-transition`}
                  presentation={fade()}
                  timing={linearTiming({
                    durationInFrames: transitionDurationInFrames,
                  })}
                />
              )}
            </>
          );
        })}
      </TransitionSeries>
      {captionsFile && <CaptionsOverlay captionsFile={captionsFile} />}
    </AbsoluteFill>
  );
};
