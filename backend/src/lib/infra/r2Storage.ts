import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  getR2BucketName,
  getR2EndpointUrl,
  getR2PublicUrl,
  r2Configured,
} from "./r2Config";

let client: S3Client | null = null;

function getClient(): S3Client {
  if (!r2Configured()) {
    throw new Error("R2 storage is not configured");
  }
  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: getR2EndpointUrl()!,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!.trim(),
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!.trim(),
      },
    });
  }
  return client;
}

export { r2Configured };

export function safeStorageFilename(filename: string): string {
  const base = filename.split(/[/\\]/).pop()?.trim() || "file";
  const cleaned = base.replace(/[^\w.\-()+\s]/g, "_").replace(/\s+/g, "_");
  return cleaned.slice(0, 180) || "file";
}

export function buildUserDocumentKey(params: {
  userId: string;
  docId: string;
  filename: string;
  projectId?: string | null;
}): string {
  const safe = safeStorageFilename(params.filename);
  if (params.projectId) {
    return `users/${params.userId}/projects/${params.projectId}/documents/${params.docId}/${safe}`;
  }
  return `users/${params.userId}/documents/${params.docId}/${safe}`;
}

export function buildRagDocumentKey(params: {
  userId: string;
  startupId: string;
  docId: string;
  filename: string;
}): string {
  const safe = safeStorageFilename(params.filename);
  return `users/${params.userId}/startups/${params.startupId}/rag/${params.docId}/${safe}`;
}

export async function uploadObject(params: {
  key: string;
  body: Buffer;
  contentType: string;
}): Promise<void> {
  await getClient().send(
    new PutObjectCommand({
      Bucket: getR2BucketName(),
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType,
    }),
  );
}

export async function downloadObject(key: string): Promise<Buffer | null> {
  if (!r2Configured()) return null;
  try {
    const response = await getClient().send(
      new GetObjectCommand({ Bucket: getR2BucketName(), Key: key }),
    );
    if (!response.Body) return null;
    const bytes = await response.Body.transformToByteArray();
    return Buffer.from(bytes);
  } catch {
    return null;
  }
}

export async function deleteObject(key: string): Promise<void> {
  if (!r2Configured() || !key) return;
  await getClient().send(
    new DeleteObjectCommand({ Bucket: getR2BucketName(), Key: key }),
  );
}

export async function getObjectDownloadUrl(
  key: string,
  filename: string,
  expiresInSeconds = 3600,
): Promise<string | null> {
  const publicBase = getR2PublicUrl();
  if (publicBase) {
    return `${publicBase}/${key.split("/").map(encodeURIComponent).join("/")}`;
  }
  if (!r2Configured()) return null;
  const command = new GetObjectCommand({
    Bucket: getR2BucketName(),
    Key: key,
    ResponseContentDisposition: `attachment; filename="${safeStorageFilename(filename).replace(/"/g, "")}"`,
  });
  return getSignedUrl(getClient(), command, { expiresIn: expiresInSeconds });
}

export function detectFileType(
  filename: string,
  mimeType: string,
): string | null {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "pdf" || mimeType === "application/pdf") return "pdf";
  if (
    ext === "docx" ||
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "docx";
  }
  if (ext === "doc" || mimeType === "application/msword") return "doc";
  if (ext === "csv" || mimeType === "text/csv") return "csv";
  if (ext === "txt" || mimeType === "text/plain") return "txt";
  return ext ?? null;
}
