// Phase 6/7 audit results: per-clip keep window (trimBefore/trimAfter in frames @24fps).
// Source: whisper word-level timestamps (scripts/captions/clip*.json) for speech
// boundaries, cross-checked against 5fps tail contact sheets (t=7.0-9.8s, 0.2s
// steps) for visual activity, plus 2fps full-clip sheets for head activity.
//
// Every clip's speech begins within 0-0.4s (clip 8 is the exception - see below) so
// there is no dead head to trim in any clip; trimBefore is 0 throughout.
//
// Tail findings:
//   1 (Host Intro): speech ends 5.08s. Hand-to-hair gesture continues (active) through
//     ~9.2s (confirmed via 0.2s-spaced frames). Settles to a static smile from ~9.4s.
//     Cut at 9.375s (225f), leaving buffer before the confirmed-static point.
//   2 (Three Layers): speech ends 7.24s. Icon is still morphing (platform reshaping,
//     globe resizing/settling) through ~8.2s - matches whisper's "(logo popping)" sound
//     event at 7.44-9.82s. Settles static after. Cut at 8.33s (200f).
//   3 (What a Region Is): speech ends 7.68s. Visual (small filled globe/target icon)
//     is already static at the start of the tail sample (7.0s) and stays static to the
//     end - settled well before speech even finishes. Cut at 7.75s (186f), just past
//     speech end for safety margin.
//   4 (Availability Zones): speech ends 7.32s. Building network icon fully static
//     across the entire 7.0-9.8s tail sample. Cut at 7.42s (178f).
//   5 (Failover): speech ends 8.12s. Connector line between buildings is still
//     drawing/highlighting through ~8.4-8.6s. Settles after. Cut at 8.6s (206f).
//   6 (Edge Locations): speech ends 7.84s. Ring of dots around the globe is still
//     being filled in (turning orange one by one) through ~8.2s. Settles after.
//     Cut at 8.33s (200f).
//   7 (Fast Delivery/CloudFront): speech ends 6.0s. Phone icon has a pulsing glow
//     animation that keeps firing through ~8.6-8.8s before settling to a static
//     reset state. Cut at 8.83s (212f).
//   8 (Close to Customers): NO dead head despite whisper tagging 0-4.04s as
//     "[MUSIC PLAYING]" - the connecting-line/charging-bolt icon is actively
//     animating from the very start (phone appears ~1.5s, line grows continuously).
//     Speech runs 4.04-8.0s. Visual is static for the rest of the tail sample
//     (7.0-9.8s already flat where it overlaps the post-speech window). Cut at
//     8.08s (194f).
//   9 (Survives Outages): shield/globe with orbiting lightning/coin/scale icons -
//     confirmed BY THE 0.2s-spaced tail sample that the icons are still visibly
//     rotating in every single sampled frame all the way to 9.8s. No static window
//     found anywhere in the tail. Kept in full (240f - the clip's total length).
//   10 (Choosing a Region): same continuously-orbiting icon motif as clip 9 - still
//     rotating at every sampled point through 9.8s. Also, whisper has the final word
//     "decisions" running right up to the 10.0s file boundary, i.e. speech occupies
//     the entire tail anyway. Kept in full (240f).
//
// Clip 1 additionally has the Gemini/Veo sparkle watermark removed via ffmpeg
// delogo (fixed at x=375,y=745,w=45,h=45 - confirmed static screen position across
// widely-spaced timestamps) baked into public/videos/myself/1-clean.mp4, used in
// place of the raw source for the montage.
//
// Phase 11(b) filler cut: clip 1's post-speech hand-to-hair gesture (~5.08s-9.2s)
// is a generic idle gesture with no connection to the AWS topic - it doesn't
// illustrate or explain anything, unlike every other clip's post-speech motion
// (which is always the direct visual payoff of the concept just spoken: layers
// assembling, zones connecting, etc). Per the explicit "generic idle gesture"
// example in the compression rules, this is unambiguous non-explanatory filler,
// so it is cut entirely (not just shortened) - trimAfter dropped from the
// Phase 6/7 baseline of 225f down to 132f (speech end at 5.08s/122f + a 0.417s
// buffer for a natural close, well short of where the gesture even starts).
export const CUTLIST = [
  { n: 1, label: "Host Intro", file: "1-clean.mp4", trimBefore: 0, trimAfter: 132 },
  { n: 2, label: "Three Layers", file: "2 clip.mp4", trimBefore: 0, trimAfter: 200 },
  { n: 3, label: "What a Region Is", file: "3 clip.mp4", trimBefore: 0, trimAfter: 186 },
  { n: 4, label: "Availability Zones", file: "4 clip.mp4", trimBefore: 0, trimAfter: 178 },
  { n: 5, label: "Failover Between Zones", file: "5 clip.mp4", trimBefore: 0, trimAfter: 206 },
  { n: 6, label: "Edge Locations", file: "6 clip.mp4", trimBefore: 0, trimAfter: 200 },
  { n: 7, label: "Fast Delivery", file: "7 clip.mp4", trimBefore: 0, trimAfter: 212 },
  { n: 8, label: "Close to Your Customers", file: "8 clip.mp4", trimBefore: 0, trimAfter: 194 },
  { n: 9, label: "Built to Survive Outages", file: "9 clip.mp4", trimBefore: 0, trimAfter: 240 },
  { n: 10, label: "Choosing a Region Matters", file: "10 clip.mp4", trimBefore: 0, trimAfter: 240 },
];
