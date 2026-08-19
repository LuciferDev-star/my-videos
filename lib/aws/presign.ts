import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getS3Client } from "./s3-client";
import { mimeTypeForFile } from "../video-extensions";

// Bucket stays private throughout - every URL handed to the browser is a
// short-lived presigned GET/PUT, never a public object. `region` must match
// the bucket's actual region (source clips bucket and Remotion Lambda's
// output bucket may differ).
export async function presignGet(
  region: string,
  bucket: string,
  key: string,
  expiresInSeconds: number,
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
    ResponseContentType: mimeTypeForFile(key),
  });
  return getSignedUrl(getS3Client(region), command, { expiresIn: expiresInSeconds });
}

export async function presignPut(
  region: string,
  bucket: string,
  key: string,
  contentType: string,
  expiresInSeconds: number,
): Promise<string> {
  const command = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType });
  return getSignedUrl(getS3Client(region), command, { expiresIn: expiresInSeconds });
}
