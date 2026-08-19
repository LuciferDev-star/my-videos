"use client";

import { useEffect, useState } from "react";
import type { ClipsMontageProps } from "../../../lib/remotion-schema";

type ActiveRender = { renderId: string; bucketName: string };

const POLL_INTERVAL_MS = 2500;
const SESSION_STORAGE_KEY = "video-editor-active-render";

export function RenderPanel({
  renderProps,
}: {
  renderProps: ClipsMontageProps | null;
}) {
  const [activeRender, setActiveRender] = useState<ActiveRender | null>(null);
  const [progress, setProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  // Resume polling if the editor refreshed the page mid-render. sessionStorage
  // isn't available during server rendering, so this has to run post-mount -
  // reading it in a useState initializer instead would create a server/client
  // hydration mismatch.
  useEffect(() => {
    const saved = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!saved) {
      return;
    }
    try {
      // One-time resume from browser storage on mount, not a derived-state loop.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveRender(JSON.parse(saved));
    } catch {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (!activeRender) {
      return;
    }

    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(
          `/api/render/progress?renderId=${encodeURIComponent(activeRender.renderId)}&bucketName=${encodeURIComponent(activeRender.bucketName)}`,
        );
        const data = await res.json();
        if (cancelled) {
          return;
        }

        if (data.fatalErrorEncountered) {
          sessionStorage.removeItem(SESSION_STORAGE_KEY);
          setErrorMessage("Render failed. Check the AWS Lambda logs for details.");
          setActiveRender(null);
          return;
        }

        if (data.done && data.outKey) {
          const downloadRes = await fetch(
            `/api/render/download?bucketName=${encodeURIComponent(activeRender.bucketName)}&outKey=${encodeURIComponent(data.outKey)}`,
          );
          const downloadData = await downloadRes.json();
          if (cancelled) {
            return;
          }
          sessionStorage.removeItem(SESSION_STORAGE_KEY);
          setDownloadUrl(downloadData.url);
          setActiveRender(null);
          return;
        }

        setProgress(data.overallProgress ?? 0);
      } catch {
        // Transient network error - keep polling on the next interval.
      }
    };

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [activeRender]);

  const handleGenerate = async () => {
    if (!renderProps) {
      return;
    }
    setStarting(true);
    setErrorMessage(null);
    setDownloadUrl(null);

    try {
      const res = await fetch("/api/render/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(renderProps),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrorMessage(data.error ?? "Failed to start render.");
        return;
      }

      const data = await res.json();

      if (data.mode === "local") {
        // Local mode (RENDER_TARGET unset or "local") renders synchronously
        // on this server - by the time this response arrives, out/*.mp4
        // already exists, so there's nothing to poll.
        setDownloadUrl(data.downloadUrl);
        return;
      }

      const render: ActiveRender = { renderId: data.renderId, bucketName: data.bucketName };
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(render));
      setProgress(0);
      setActiveRender(render);
    } catch {
      setErrorMessage("Failed to start render.");
    } finally {
      setStarting(false);
    }
  };

  const isRendering = activeRender !== null;
  const isBusy = starting || isRendering;

  return (
    <div className="space-y-3 rounded border border-neutral-800 p-4">
      <button
        type="button"
        onClick={handleGenerate}
        disabled={!renderProps || isBusy}
        className="w-full rounded bg-green-600 px-4 py-2 text-sm font-semibold text-white disabled:bg-neutral-700 disabled:text-neutral-500"
      >
        {isBusy ? "Generating..." : "Generate video"}
      </button>

      {starting && !isRendering && (
        <p className="text-sm text-neutral-400">
          Rendering locally - this can take a minute or two for a full video.
        </p>
      )}

      {isRendering && (
        <p className="text-sm text-neutral-400">
          Rendering... {Math.round(progress * 100)}%
        </p>
      )}

      {errorMessage && <p className="text-sm text-red-400">{errorMessage}</p>}

      {downloadUrl && (
        <a
          href={downloadUrl}
          className="block rounded bg-blue-600 px-4 py-2 text-center text-sm font-semibold text-white"
        >
          Download final video
        </a>
      )}
    </div>
  );
}
