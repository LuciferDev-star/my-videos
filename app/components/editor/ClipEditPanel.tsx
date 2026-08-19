"use client";

import type { EditorClip, TransitionChoice } from "../../editor/useEditorState";

export function ClipEditPanel({
  clip,
  isLast,
  onChangeTrim,
  onChangeTransition,
  onChangeCaption,
}: {
  clip: EditorClip;
  isLast: boolean;
  onChangeTrim: (trimBeforeSeconds: number, trimAfterSeconds: number) => void;
  onChangeTransition: (transitionAfter: TransitionChoice) => void;
  onChangeCaption: (captionText: string) => void;
}) {
  return (
    <div className="space-y-4 rounded border border-neutral-800 p-4">
      <h3 className="text-sm font-semibold">Editing: {clip.label || clip.id}</h3>

      <video src={clip.src} controls preload="metadata" className="w-full rounded" />

      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs text-neutral-400">
          Start (s)
          <input
            type="number"
            min={0}
            max={clip.sourceDurationSeconds}
            step={0.1}
            value={clip.trimBeforeSeconds}
            onChange={(event) =>
              onChangeTrim(Number(event.target.value), clip.trimAfterSeconds)
            }
            className="mt-1 w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm text-neutral-100"
          />
        </label>
        <label className="text-xs text-neutral-400">
          End (s)
          <input
            type="number"
            min={clip.trimBeforeSeconds}
            max={clip.sourceDurationSeconds}
            step={0.1}
            value={clip.trimAfterSeconds}
            onChange={(event) =>
              onChangeTrim(clip.trimBeforeSeconds, Number(event.target.value))
            }
            className="mt-1 w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm text-neutral-100"
          />
        </label>
      </div>

      {clip.sourceDurationSeconds !== undefined && (
        <p className="text-xs text-neutral-500">
          Full clip length: {clip.sourceDurationSeconds.toFixed(1)}s
        </p>
      )}

      <label className="block text-xs text-neutral-400">
        Transition after this clip
        <select
          value={clip.transitionAfter}
          disabled={isLast}
          onChange={(event) =>
            onChangeTransition(event.target.value as TransitionChoice)
          }
          className="mt-1 w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm text-neutral-100 disabled:opacity-40"
        >
          <option value="fade">Crossfade</option>
          <option value="none">Hard cut</option>
        </select>
      </label>

      <label className="block text-xs text-neutral-400">
        Caption / text overlay (optional)
        <textarea
          value={clip.captionText ?? ""}
          onChange={(event) => onChangeCaption(event.target.value)}
          rows={2}
          placeholder="Text shown on screen for this clip"
          className="mt-1 w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm text-neutral-100"
        />
      </label>
    </div>
  );
}
