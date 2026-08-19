"use client";

import { useState } from "react";
import { useEditorState } from "./useEditorState";
import { useS3Clips } from "./useS3Clips";
import { UploadDropzone } from "../components/editor/UploadDropzone";
import { ClipBrowser } from "../components/editor/ClipBrowser";
import { SelectedClipsList } from "../components/editor/SelectedClipsList";
import { ClipEditPanel } from "../components/editor/ClipEditPanel";
import { PromptBar } from "../components/editor/PromptBar";
import { PreviewPlayer } from "../components/editor/PreviewPlayer";
import { RenderPanel } from "../components/editor/RenderPanel";

export default function EditorPage() {
  const { state, dispatch, renderProps } = useEditorState();
  const { clips, error, refetch } = useS3Clips();
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);

  const selectedIndex = state.clips.findIndex(
    (clip) => clip.id === selectedClipId,
  );
  const selectedClip = selectedIndex === -1 ? null : state.clips[selectedIndex];

  return (
    <main className="mx-auto max-w-6xl space-y-8 p-6">
      <header>
        <h1 className="text-xl font-semibold">Video Editor</h1>
        <p className="text-sm text-neutral-400">
          Upload or pick clips from the bucket, arrange them into a
          timeline, edit with the prompt box or the controls below it, then
          generate the final video.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
          1. Upload clips
        </h2>
        <UploadDropzone onUploaded={refetch} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
          2. Clips in the bucket
        </h2>
        <ClipBrowser
          clips={clips}
          error={error}
          selectedIds={state.clips.map((clip) => clip.id)}
          dispatch={dispatch}
        />
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_auto]">
        <div className="space-y-6">
          <div className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
              3. Timeline ({state.clips.length}{" "}
              clip{state.clips.length === 1 ? "" : "s"})
            </h2>
            <SelectedClipsList
              clips={state.clips}
              selectedClipId={selectedClipId}
              onSelect={setSelectedClipId}
              onMove={(id, direction) =>
                dispatch({ type: "MOVE_CLIP", id, direction })
              }
              onRemove={(id) => {
                dispatch({ type: "REMOVE_CLIP", id });
                setSelectedClipId((current) => (current === id ? null : current));
              }}
            />
          </div>

          <PromptBar clips={state.clips} dispatch={dispatch} />

          {selectedClip && (
            <ClipEditPanel
              clip={selectedClip}
              isLast={selectedIndex === state.clips.length - 1}
              onChangeTrim={(trimBeforeSeconds, trimAfterSeconds) =>
                dispatch({
                  type: "SET_TRIM",
                  id: selectedClip.id,
                  trimBeforeSeconds,
                  trimAfterSeconds,
                })
              }
              onChangeTransition={(transitionAfter) =>
                dispatch({
                  type: "SET_TRANSITION",
                  id: selectedClip.id,
                  transitionAfter,
                })
              }
              onChangeCaption={(captionText) =>
                dispatch({
                  type: "SET_CAPTION",
                  id: selectedClip.id,
                  captionText,
                })
              }
            />
          )}

          <RenderPanel renderProps={renderProps} />
        </div>

        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
            4. Preview
          </h2>
          <PreviewPlayer renderProps={renderProps} />
        </div>
      </section>
    </main>
  );
}
