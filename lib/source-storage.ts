export function isS3SourceEnabled(): boolean {
  return Boolean(
    process.env.SOURCE_CLIPS_BUCKET?.trim() &&
      process.env.SOURCE_CLIPS_REGION?.trim(),
  );
}
