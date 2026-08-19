"use client";

import { useState } from "react";
import type { Action, EditorClip } from "../../editor/useEditorState";
import type { S3Clip } from "../../editor/useS3Clips";

// Best-effort - a failed/slow transcription should never stop a clip from
// being added, so this is fire-and-forget from the caller's perspective.
// See app/api/ai/transcribe-clip/route.ts, which itself never errors out
// (always resolves, worst case with an empty captions array).
async function transcribeAndDispatch(clip: EditorClip, dispatch: (action: Action) => void) {
  try {
    const response = await fetch("/api/ai/transcribe-clip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ src: clip.src }),
    });
    const data = await response.json();
    if (data.captions?.length) {
      dispatch({ type: "SET_CAPTIONS", id: clip.id, captions: data.captions });
    }
  } catch {
    // Silently leave the clip caption-less - see the module comment above.
  }
}

function defaultLabelFromKey(key: string): string {
  const fileName = key.split("/").pop() ?? key;
  return fileName.replace(/\.[^.]+$/, "");
}

// Chrome (and some other browsers) report duration as Infinity on
// loadedmetadata for certain MP4s until the video is seeked near the end -
// a well-known quirk, not specific to any file here. Force that seek so we
// always end up with a real, finite duration before it's used for trims.
function resolveDuration(video: HTMLVideoElement, onResolved: (duration: number) => void) {
  if (Number.isFinite(video.duration)) {
    onResolved(video.duration);
    return;
  }

  const handleTimeUpdate = () => {
    video.removeEventListener("timeupdate", handleTimeUpdate);
    video.currentTime = 0;
    onResolved(video.duration);
  };
  video.addEventListener("timeupdate", handleTimeUpdate);
  video.currentTime = 1e101;
}

export function ClipBrowser({
  clips,
  error,
  selectedIds,
  dispatch,
}: {
  clips: S3Clip[] | null;
  error: string | null;
  selectedIds: string[];
  dispatch: (action: Action) => void;
}) {
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [durations, setDurations] = useState<Record<string, number>>({});
  const [transcribingIds, setTranscribingIds] = useState<Set<string>>(new Set());

  if (error) {
    return <p className="text-sm text-red-400">{error}</p>;
  }

  if (!clips) {
    return <p className="text-sm text-neutral-400">Loading clips from S3...</p>;
  }

  if (clips.length === 0) {
    return (
      <p className="text-sm text-neutral-400">
        No video clips in the bucket yet - upload some above to get started.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {clips.map((clip) => {
        const alreadyAdded = selectedIds.includes(clip.key);
        const label = labels[clip.key] ?? defaultLabelFromKey(clip.key);
        const duration = durations[clip.key];
        const canAdd = !alreadyAdded && Boolean(duration);

        return (
          <div
            key={clip.key}
            className="space-y-2 rounded-lg border border-neutral-800 p-3"
          >
            <video
              src={clip.previewUrl}
              controls
              preload="metadata"
              className="w-full rounded"
              onLoadedMetadata={(event) => {
                resolveDuration(event.currentTarget, (duration) => {
                  setDurations((prev) => ({ ...prev, [clip.key]: duration }));
                });
              }}
            />
            <input
              type="text"
              value={label}
              onChange={(event) =>
                setLabels((prev) => ({ ...prev, [clip.key]: event.target.value }))
              }
              placeholder="Clip name"
              className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm text-neutral-100"
            />
            <button
              type="button"
              disabled={!canAdd}
              onClick={() => {
                const editorClip: EditorClip = {
                  id: clip.key,
                  src: clip.previewUrl,
                  label,
                  sourceDurationSeconds: duration,
                  trimBeforeSeconds: 0,
                  trimAfterSeconds: duration ?? 0,
                  transitionAfter: "fade",
                };
                dispatch({ type: "ADD_CLIP", clip: editorClip });

                setTranscribingIds((prev) => new Set(prev).add(clip.key));
                transcribeAndDispatch(editorClip, dispatch).finally(() => {
                  setTranscribingIds((prev) => {
                    const next = new Set(prev);
                    next.delete(clip.key);
                    return next;
                  });
                });
              }}
              className="w-full rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white disabled:bg-neutral-700 disabled:text-neutral-500"
            >
              {alreadyAdded ? "Added" : "Add to timeline"}
            </button>
            {transcribingIds.has(clip.key) && (
              <p className="text-xs text-neutral-500">Transcribing captions...</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
