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

function isUsableDuration(duration: number): boolean {
  return Number.isFinite(duration) && duration > 0;
}

// Chrome (and some other browsers) report duration as Infinity or 0 on
// loadedmetadata for certain MP4s until the video is seeked near the end.
// Force that seek so we always end up with a real, finite duration.
function resolveDuration(video: HTMLVideoElement, onResolved: (duration: number) => void) {
  if (isUsableDuration(video.duration)) {
    onResolved(video.duration);
    return;
  }

  const handleTimeUpdate = () => {
    video.removeEventListener("timeupdate", handleTimeUpdate);
    video.currentTime = 0;
    if (isUsableDuration(video.duration)) {
      onResolved(video.duration);
    }
  };
  video.addEventListener("timeupdate", handleTimeUpdate);
  video.currentTime = 1e101;
}

function waitForDuration(video: HTMLVideoElement, timeoutMs = 10000): Promise<number> {
  if (isUsableDuration(video.duration)) {
    return Promise.resolve(video.duration);
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (duration: number) => {
      if (settled) {
        return;
      }
      settled = true;
      window.clearTimeout(timer);
      video.removeEventListener("loadedmetadata", onMeta);
      video.removeEventListener("durationchange", onMeta);
      video.removeEventListener("error", onError);
      resolve(duration);
    };

    const onMeta = () => {
      resolveDuration(video, finish);
    };
    const onError = () => finish(0);
    const timer = window.setTimeout(() => {
      finish(isUsableDuration(video.duration) ? video.duration : 0);
    }, timeoutMs);

    video.addEventListener("loadedmetadata", onMeta);
    video.addEventListener("durationchange", onMeta);
    video.addEventListener("error", onError);
    resolveDuration(video, finish);
    void video.play().then(
      () => {
        video.pause();
        video.currentTime = 0;
      },
      () => {
        // Autoplay may be blocked; metadata listeners above still run.
      },
    );
  });
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
  const [loadErrors, setLoadErrors] = useState<Record<string, string>>({});
  const [addingIds, setAddingIds] = useState<Set<string>>(new Set());
  const [transcribingIds, setTranscribingIds] = useState<Set<string>>(new Set());

  if (error) {
    return <p className="text-sm text-red-400">{error}</p>;
  }

  if (!clips) {
    return <p className="text-sm text-neutral-400">Loading clips...</p>;
  }

  if (clips.length === 0) {
    return (
      <p className="text-sm text-neutral-400">
        No video clips yet - upload some above to get started.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {clips.map((clip) => {
        const alreadyAdded = selectedIds.includes(clip.key);
        const isAdding = addingIds.has(clip.key);
        const label = labels[clip.key] ?? defaultLabelFromKey(clip.key);
        const duration = durations[clip.key];
        const loadError = loadErrors[clip.key];

        return (
          <div
            key={clip.key}
            className="space-y-2 rounded-lg border border-neutral-800 p-3"
          >
            <video
              src={clip.previewUrl}
              controls
              preload="auto"
              playsInline
              className="w-full rounded"
              onLoadedMetadata={(event) => {
                resolveDuration(event.currentTarget, (nextDuration) => {
                  setDurations((prev) => ({ ...prev, [clip.key]: nextDuration }));
                  setLoadErrors((prev) => {
                    const next = { ...prev };
                    delete next[clip.key];
                    return next;
                  });
                });
              }}
              onError={() => {
                setLoadErrors((prev) => ({
                  ...prev,
                  [clip.key]:
                    "This clip did not load. Re-upload the file, or if you are using S3 later, allow GET/HEAD in the bucket CORS rules.",
                }));
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
              disabled={alreadyAdded || isAdding}
              onClick={async (event) => {
                setAddingIds((prev) => new Set(prev).add(clip.key));
                const card = event.currentTarget.closest("div");
                const video = card?.querySelector("video");
                const knownDuration =
                  duration && isUsableDuration(duration)
                    ? duration
                    : video
                      ? await waitForDuration(video)
                      : 0;

                if (!isUsableDuration(knownDuration)) {
                  setAddingIds((prev) => {
                    const next = new Set(prev);
                    next.delete(clip.key);
                    return next;
                  });
                  setLoadErrors((prev) => ({
                    ...prev,
                    [clip.key]:
                      "Could not read this clip's duration. Play the preview once, then try Add to timeline again.",
                  }));
                  return;
                }

                setDurations((prev) => ({ ...prev, [clip.key]: knownDuration }));

                const editorClip: EditorClip = {
                  id: clip.key,
                  src: clip.previewUrl,
                  label,
                  sourceDurationSeconds: knownDuration,
                  trimBeforeSeconds: 0,
                  trimAfterSeconds: knownDuration,
                  transitionAfter: "fade",
                };
                dispatch({ type: "ADD_CLIP", clip: editorClip });
                setAddingIds((prev) => {
                  const next = new Set(prev);
                  next.delete(clip.key);
                  return next;
                });

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
              {alreadyAdded ? "Added" : isAdding ? "Adding..." : "Add to timeline"}
            </button>
            {loadError && <p className="text-xs text-red-400">{loadError}</p>}
            {transcribingIds.has(clip.key) && (
              <p className="text-xs text-neutral-500">Transcribing captions...</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
