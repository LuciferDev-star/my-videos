import { S3Client } from "@aws-sdk/client-s3";

const clients = new Map<string, S3Client>();

// Reuses the same IAM user Remotion Lambda's own setup creates (extended
// with S3 list/get permissions on the source bucket) - see the deployment
// README for the exact policy addition. One credential pair is enough for a
// single-editor internal tool. Cached per-region because the source clips
// bucket and the Remotion Lambda output bucket aren't guaranteed to be in
// the same AWS region.
export function getS3Client(region: string): S3Client {
  const existing = clients.get(region);
  if (existing) {
    return existing;
  }

  const accessKeyId = process.env.REMOTION_AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.REMOTION_AWS_SECRET_ACCESS_KEY;

  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      "Missing AWS credentials: set REMOTION_AWS_ACCESS_KEY_ID and REMOTION_AWS_SECRET_ACCESS_KEY.",
    );
  }

  const client = new S3Client({ region, credentials: { accessKeyId, secretAccessKey } });
  clients.set(region, client);
  return client;
}
