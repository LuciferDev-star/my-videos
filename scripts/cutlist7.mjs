// Audit trail for the 7-clip "Learn AWS for free" montage (src/scenes/ClipsMontage.tsx).
// Source: whisper word-level timestamps (scripts/captions7/clip*.json) for
// speech boundaries, cross-checked against 0.2-0.4s-spaced contact sheets
// for visual activity (icon glow/settle points, pulsing animations).
//
// PHASE 1 (captions): no burned-in captions/subtitles found in any of the
// 7 raw clips.
//
// PHASE 2 (watermark): ALL 7 clips carry the same fixed-position Gemini/Veo
// sparkle badge at pixel bbox x=372-428,y=742-798 (of a 478x850 frame,
// bottom-right area, confirmed static across widely-spaced timestamps in
// every clip). Removed via ffmpeg delogo (x=372,y=742,w=56,h=56) into
// public/videos/clean/{n}-clean.mp4 for all 7 clips - background at that
// spot is a plain wall/blurred backdrop (clip 1) or flat gray gradient
// (clips 2-7) in every case, so delogo inpainting is seamless with no
// crop/reframe needed.
//
// PHASE 4 (duplicates):
//  - Clip 6 has an internal duplicate: whisper timestamps show "beginner."
//    spoken twice back to back (5540-6000ms, then again 6000-6500ms)
//    before a "(beep)" sound effect at 6500-8420ms. Verified with two
//    independent whisper passes. The visual (bell + checkbox icon) is
//    static/unchanged through both instances - the glow/checkmark
//    animation doesn't start until ~6.6s, after the cut point - so
//    removing the second "beginner." (6000-6500ms) does not cut into any
//    active visual. Implemented as a hard cut inside clip 6 in
//    ClipsMontage.tsx (segment A: 0-144f, segment B: 156-204f).
//  - Clip 4 is a content defect, not a simple duplicate: its VISUAL
//    (hourglass icon alongside the Always-Free/12-months medals) correctly
//    matches script line 4 ("Trials"), but its actual spoken audio -
//    confirmed independently via two separate whisper transcriptions -
//    is "In 750 hours of a small EC2 server or 500 the also 100 of S3
//    storage for your first year," a garbled near-duplicate of clip 3's
//    "12 Months Free" line. The real "Trials" script line does not exist
//    as spoken audio in any of the 7 source clips. Flagged to the user;
//    user chose to keep clip 4 with its actual (wrong/duplicate) audio
//    rather than drop the clip or mute it. Burned-in captions for clip 4
//    reflect the actual spoken words (per Phase 10's "transcribe the
//    actual spoken audio"), not the intended script line.
//
// PHASE 5 (voice consistency): no audio-listening capability available in
// this pipeline to judge accent/pitch perceptually. As an objective proxy,
// computed speaking rate from whisper word timestamps for all 7 clips:
// roughly 100-160 words/minute, no extreme outlier. This does NOT
// substitute for a perceptual check - flagged in the final report as an
// open item for a quick human listen-through.
//
// PHASE 6/7 (dead segment audit + trim - only dead segments cut):
//   1 (Hook): speech ends 5.28s. Hand gesture is concurrent with speech,
//     already back to a static resting smile by 5.4s, confirmed static
//     every 0.4s through 9.8s. Cut at 5.583s (134f), a ~0.3s buffer past
//     speech end.
//   2 (Three Types): speech ends 8.76s. Badge glow has already finished
//     animating and just holds steady (no further change) through 9.6s.
//     Cut at 9.0s (216f).
//   3 (12 Months Free): speech ends 9.6s of a 10.01s clip - negligible
//     tail, not worth trimming. Kept in full (240f).
//   4 (kept per user decision): actual spoken audio runs to ~10.0s, no
//     dead tail to trim. Kept in full (240f).
//   5 (The Catch): speech ends 7.24s, but the warning-triangle glow keeps
//     pulsing/breathing all the way to the 9.8s sample point with no
//     settle - matches the explicitly-protected "pulsing" visual class.
//     Ambiguous whether it ever fully stops; default to keeping. Kept in
//     full (240f).
//   6 (Billing Alerts): after the duplicate-removal hard cut (see Phase 4),
//     the bell+checkmark glow animation runs through the "(beep)" sound
//     effect and is visibly settled by 7.4s, but the beep audio itself
//     continues (non-silent) to 8.42s - only silent+static counts as dead,
//     so the tail is kept through 8.5s (204f) and only the truly dead
//     remainder (8.5-10.0s, silent AND static) is cut.
//   7 (Teaser): speech ends 6.0s, but the arrow icon has a continuous
//     pulsing-chevron animation (explicitly named as a protected visual in
//     the brief) that keeps firing intermittently all the way to the
//     9.8s sample point. Kept in full (240f).
//
// PHASE 9 (transitions): 12-frame (0.5s) crossfades, within the 0.3-0.5s
// spec - also brings the assembled runtime to 59.58s, under the 60s
// target without needing any Phase 11 compression.
export const NOTE = "See comments above for the full audit.";
