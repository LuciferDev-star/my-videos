import { AbsoluteFill } from "remotion";

// Displays a single manually-typed caption/text overlay for a clip's full
// on-screen duration. Deliberately NOT a transcription/STT pipeline like
// CaptionsOverlay - the guided editor UI collects this text directly from
// the editor, so there's no AI inference involved at render time. Reuses
// CaptionsOverlay's visual style (bottom-anchored, semi-transparent box) so
// manual and legacy whisper-derived captions look the same on screen.
export const ClipCaptionOverlay: React.FC<{ text: string }> = ({ text }) => {
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
