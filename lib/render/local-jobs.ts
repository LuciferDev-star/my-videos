import type { ClipsMontageProps } from "../remotion-schema";
import { renderLocally } from "./local-render";

export type LocalRenderJob = {
  renderId: string;
  status: "running" | "done" | "error";
  overallProgress: number;
  fileName?: string;
  error?: string;
};

const jobs = new Map<string, LocalRenderJob>();

export function getLocalRenderJob(renderId: string): LocalRenderJob | undefined {
  return jobs.get(renderId);
}

export function startLocalRenderJob(inputProps: ClipsMontageProps): string {
  const renderId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  jobs.set(renderId, {
    renderId,
    status: "running",
    overallProgress: 0,
  });

  void renderLocally(inputProps, {
    onProgress: (overallProgress) => {
      const job = jobs.get(renderId);
      if (job && job.status === "running") {
        jobs.set(renderId, { ...job, overallProgress });
      }
    },
  })
    .then(({ fileName }) => {
      jobs.set(renderId, {
        renderId,
        status: "done",
        overallProgress: 1,
        fileName,
      });
    })
    .catch((error: unknown) => {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Local render failed.";
      console.error("Local render failed", error);
      jobs.set(renderId, {
        renderId,
        status: "error",
        overallProgress: 0,
        error: message,
      });
    });

  return renderId;
}
