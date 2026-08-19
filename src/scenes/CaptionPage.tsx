import { AbsoluteFill } from "remotion";

// Shared visual style for a page of synced captions - used by both the
// legacy whisper-file overlay (CaptionsOverlay.tsx) and the per-clip
// auto-transcribed overlay (SyncedCaptionOverlay.tsx), so manually-typed
// (ClipCaptionOverlay), legacy, and auto-transcribed captions all look the
// same on screen. Takes just the display text - callers own how they
// derive it (a TikTokPage's combined text, or a single transcript phrase).
export const CaptionPage: React.FC<{ text: string }> = ({ text }) => {
  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "center",
        paddingBottom: 160,
      }}
    >
      <div
        style={{
          maxWidth: 900,
          padding: "20px 32px",
          borderRadius: 16,
          backgroundColor: "rgba(0, 0, 0, 0.55)",
        }}
      >
        <p
          style={{
            margin: 0,
            textAlign: "center",
            whiteSpace: "pre-wrap",
            fontFamily: "system-ui, -apple-system, sans-serif",
            fontWeight: 700,
            fontSize: 44,
            lineHeight: 1.3,
            color: "#ffffff",
          }}
        >
          {text}
        </p>
      </div>
    </AbsoluteFill>
  );
};
