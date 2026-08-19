"use client";

import { useCallback, useRef, useState } from "react";

type UploadState = {
  fileName: string;
  progress: number;
  status: "uploading" | "done" | "error";
  message?: string;
};

function isVideoFile(file: File): boolean {
  return /\.(mp4|mov|webm|m4v)$/i.test(file.name);
}

async function uploadFile(file: File, onProgress: (percent: number) => void): Promise<void> {
  const res = await fetch("/api/s3/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName: file.name, contentType: file.type }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Failed to get an upload URL.");
  }

  const { uploadUrl } = await res.json();

  // XMLHttpRequest (not fetch) so we get upload progress events - important
  // for video files, which can take a while to upload directly to S3.
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", file.type || "video/mp4");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed (status ${xhr.status}).`));
      }
    };
    xhr.onerror = () => reject(new Error("Upload failed."));
    xhr.send(file);
  });
}

// Two ways in: drag video files onto this zone from the desktop, or click to
// pick files via the OS file dialog. Both upload straight to S3 via a
// presigned PUT (the files never pass through this app's server).
export function UploadDropzone({ onUploaded }: { onUploaded: () => void }) {
  const [uploads, setUploads] = useState<UploadState[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList) {
        return;
      }

      const files = Array.from(fileList).filter(isVideoFile);

      files.forEach((file) => {
        setUploads((prev) => [
          ...prev,
          { fileName: file.name, progress: 0, status: "uploading" },
        ]);

        uploadFile(file, (progress) => {
          setUploads((prev) =>
            prev.map((upload) =>
              upload.fileName === file.name && upload.status === "uploading"
                ? { ...upload, progress }
                : upload,
            ),
          );
        })
          .then(() => {
            setUploads((prev) =>
              prev.map((upload) =>
                upload.fileName === file.name
                  ? { ...upload, status: "done", progress: 100 }
                  : upload,
              ),
            );
            onUploaded();
          })
          .catch((err: Error) => {
            setUploads((prev) =>
              prev.map((upload) =>
                upload.fileName === file.name
                  ? { ...upload, status: "error", message: err.message }
                  : upload,
              ),
            );
          });
      });
    },
    [onUploaded],
  );

  return (
    <div className="space-y-3">
      <div
        role="button"
        tabIndex={0}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          handleFiles(event.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            inputRef.current?.click();
          }
        }}
        className={`cursor-pointer rounded-lg border-2 border-dashed p-6 text-center text-sm transition-colors ${
          isDragging
            ? "border-blue-500 bg-blue-950/30 text-blue-200"
            : "border-neutral-700 text-neutral-400"
        }`}
      >
        Drag video files here, or click to choose files to upload.
        <input
          ref={inputRef}
          type="file"
          accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm,.m4v"
          multiple
          className="hidden"
          onChange={(event) => {
            handleFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </div>

      {uploads.length > 0 && (
        <ul className="space-y-1 text-xs">
          {uploads.map((upload, index) => (
            <li key={`${upload.fileName}-${index}`} className="flex items-center gap-2">
              <span className="flex-1 truncate">{upload.fileName}</span>
              {upload.status === "uploading" && (
                <span className="text-neutral-400">{upload.progress}%</span>
              )}
              {upload.status === "done" && <span className="text-green-400">Uploaded</span>}
              {upload.status === "error" && (
                <span className="text-red-400">{upload.message ?? "Failed"}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
