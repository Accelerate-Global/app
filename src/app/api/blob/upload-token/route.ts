import { generateClientTokenFromReadWriteToken } from "@vercel/blob/client";
import { randomUUID } from "node:crypto";

import { getCurrentOwnerId } from "@/lib/auth";
import { MAX_CSV_BYTES, sanitizeFileName } from "@/lib/csv";
import { jsonError } from "@/lib/http";
import { blobUploadTokenSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const ownerId = await getCurrentOwnerId();

  if (!ownerId) {
    return jsonError("Unauthorized.", 401);
  }

  const parsed = blobUploadTokenSchema.safeParse(await request.json());

  if (!parsed.success) {
    return jsonError("Upload request is invalid.");
  }

  const fileName = sanitizeFileName(parsed.data.fileName);

  if (!fileName.toLowerCase().endsWith(".csv")) {
    return jsonError("Only CSV uploads are supported.");
  }

  const pathname = `users/${ownerId}/csv/${randomUUID()}-${fileName}`;
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN?.trim();

  if (!blobToken) {
    if (process.env.NODE_ENV !== "production") {
      return Response.json({
        mode: "local-dev",
        clientToken: null,
        pathname,
        blobUrl: new URL(
          `/api/blob/local/${encodeURIComponent(pathname)}`,
          request.url,
        ).toString(),
        warning:
          "BLOB_READ_WRITE_TOKEN is not configured, so local development will skip raw Blob storage.",
      });
    }

    return jsonError(
      "CSV uploads are not configured. Set BLOB_READ_WRITE_TOKEN in the app environment.",
      503,
    );
  }

  try {
    const clientToken = await generateClientTokenFromReadWriteToken({
      token: blobToken,
      pathname,
      maximumSizeInBytes: MAX_CSV_BYTES,
      allowedContentTypes: [
        "text/csv",
        "application/vnd.ms-excel",
        "text/plain",
      ],
      addRandomSuffix: false,
      allowOverwrite: false,
    });

    return Response.json({ mode: "vercel-blob", clientToken, pathname });
  } catch (error) {
    console.error("Failed to create Vercel Blob client token", error);
    return jsonError("The upload could not be authorized by Vercel Blob.", 502);
  }
}
