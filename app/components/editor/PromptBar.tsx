"use client";

import { useState } from "react";
import { PROMPT_EXAMPLES } from "../../editor/parseCommand";
import type { Action, EditorClip } from "../../editor/useEditorState";

type InterpretResponse = {
  commands?: Action[];
  errors?: { line: string; reason: string }[];
  mode?: "gemini" | "deterministic";
  error?: string;
};

// The prompt box: type edit instructions for the clips already on the
// timeline above, referring to them by position (1, 2, 3...). Sent to
// /api/ai/interpret-prompt, which understands free-form text via Gemini
// when GEMINI_API_KEY is configured, or falls back to a fixed set of
// phrasings (see app/editor/parseCommand.ts) otherwise - either way this
// component just applies whatever commands come back.
export function PromptBar({
  clips,
  dispatch,
}: {
  clips: EditorClip[];
  dispatch: (action: Action) => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [errors, setErrors] = useState<{ line: string; reason: string }[]>([]);
  const [appliedCount, setAppliedCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [mode, setMode] = useState<"gemini" | "deterministic" | null>(null);

  const handleApply = async () => {
    setIsLoading(true);
    setRequestError(null);
    setAppliedCount(null);
    setErrors([]);

    try {
      const response = await fetch("/api/ai/interpret-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, clips }),
      });
      const data: InterpretResponse = await response.json();

      if (!response.ok) {
        setRequestError(data.error ?? "Failed to interpret the prompt.");
        return;
      }

      (data.commands ?? []).forEach((command) => dispatch(command));
      setErrors(data.errors ?? []);
      setAppliedCount((data.commands ?? []).length);
      setMode(data.mode ?? null);
    } catch {
      setRequestError("Couldn't reach the server to interpret the prompt.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-3 rounded border border-neutral-800 p-4">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
          Edit with a prompt
        </h2>
        <p className="mt-1 text-xs text-neutral-500">
          Describe the edit in your own words, referring to clips by their position in the
          timeline above (1, 2, 3...). Understood by Gemini when it&apos;s configured; otherwise
          falls back to the fixed phrasings below.
        </p>
      </div>

      <textarea
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        rows={4}
        placeholder={PROMPT_EXAMPLES.join("\n")}
        disabled={clips.length === 0}
        className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 disabled:opacity-40"
      />

      <button
        type="button"
        onClick={handleApply}
        disabled={!prompt.trim() || clips.length === 0 || isLoading}
        className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:bg-neutral-700 disabled:text-neutral-500"
      >
        {isLoading ? "Thinking..." : "Apply to timeline"}
      </button>

      {clips.length === 0 && (
        <p className="text-xs text-neutral-500">
          Add clips to the timeline first, then reference them here (clip 1, clip 2...).
        </p>
      )}

      {requestError && <p className="text-xs text-red-400">{requestError}</p>}

      {appliedCount !== null && appliedCount > 0 && (
        <p className="text-xs text-green-400">
          Applied {appliedCount} instruction{appliedCount === 1 ? "" : "s"}
          {mode === "deterministic" ? " (fixed phrasings - set GEMINI_API_KEY for free text)" : ""}
          .
        </p>
      )}

      {errors.length > 0 && (
        <ul className="space-y-1 text-xs text-red-400">
          {errors.map((error, index) => (
            <li key={index}>
              &quot;{error.line}&quot; - {error.reason}
            </li>
          ))}
        </ul>
      )}

      <details className="text-xs text-neutral-500">
        <summary className="cursor-pointer select-none">Example instructions</summary>
        <ul className="mt-2 list-disc space-y-1 pl-4">
          {PROMPT_EXAMPLES.map((example) => (
            <li key={example}>
              <code>{example}</code>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
