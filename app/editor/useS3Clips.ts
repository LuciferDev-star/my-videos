"use client";

import { useCallback, useEffect, useState } from "react";

export type S3Clip = {
  key: string;
  size: number;
  lastModified: string | null;
  previewUrl: string;
};

// Lifted out of ClipBrowser so both the initial load and a post-upload
// refresh (UploadDropzone calling refetch()) share one source of truth.
export function useS3Clips() {
  const [clips, setClips] = useState<S3Clip[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(() => {
    setError(null);
    fetch("/api/s3/clips")
      .then((res) => {
        if (!res.ok) {
          throw new Error("Failed to load clips from the bucket.");
        }
        return res.json();
      })
      .then((data) => setClips(data.clips))
      .catch((err: Error) => setError(err.message));
  }, []);

  useEffect(() => {
    // Initial load on mount, not a derived-state loop - refetch() is also
    // called explicitly later (e.g. after an upload completes).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refetch();
  }, [refetch]);

  return { clips, error, refetch };
}
