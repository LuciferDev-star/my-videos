"use client";

import type { EditorClip } from "../../editor/useEditorState";

export function SelectedClipsList({
  clips,
  selectedClipId,
  onSelect,
  onMove,
  onRemove,
}: {
  clips: EditorClip[];
  selectedClipId: string | null;
  onSelect: (id: string) => void;
  onMove: (id: string, direction: "up" | "down") => void;
  onRemove: (id: string) => void;
}) {
  if (clips.length === 0) {
    return (
      <p className="text-sm text-neutral-400">
        No clips selected yet. Add clips from the bucket above.
      </p>
    );
  }

  return (
    <ol className="space-y-2">
      {clips.map((clip, index) => (
        <li
          key={clip.id}
          className={`flex items-center gap-2 rounded border px-3 py-2 ${
            selectedClipId === clip.id
              ? "border-blue-500 bg-blue-950/40"
              : "border-neutral-800"
          }`}
        >
          <button
            type="button"
            onClick={() => onSelect(clip.id)}
            className="flex-1 truncate text-left text-sm"
          >
            {index + 1}. {clip.label || clip.id}
          </button>
          <button
            type="button"
            disabled={index === 0}
            onClick={() => onMove(clip.id, "up")}
            className="px-2 text-neutral-300 disabled:opacity-30"
            aria-label="Move up"
          >
            ↑
          </button>
          <button
            type="button"
            disabled={index === clips.length - 1}
            onClick={() => onMove(clip.id, "down")}
            className="px-2 text-neutral-300 disabled:opacity-30"
            aria-label="Move down"
          >
            ↓
          </button>
          <button
            type="button"
            onClick={() => onRemove(clip.id)}
            className="px-2 text-sm text-red-400"
          >
            Remove
          </button>
        </li>
      ))}
    </ol>
  );
}
