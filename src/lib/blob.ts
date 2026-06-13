import "server-only";

/** True when Vercel Blob storage is configured (BLOB_READ_WRITE_TOKEN set). */
export function isBlobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10 MB
