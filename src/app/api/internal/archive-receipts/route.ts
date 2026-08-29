import { logError } from "@/lib/error-logging";
import { enqueueOperationalAlert } from "@/lib/operational-alerts";
import {
  authenticatePackageVerificationReceipt,
  authenticateBackupReceipt,
  buildBackupReceiptAlerts,
  DataArchiveReceiptError,
  persistBackupReceipt,
  persistPackageVerificationReceipt,
} from "@/lib/data-archive/receipt";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_RECEIPT_BODY_BYTES = 256 * 1024;
const RESPONSE_HEADERS = { "Cache-Control": "private, no-store, max-age=0" };

function response(body: unknown, status = 200) {
  return Response.json(body, { status, headers: RESPONSE_HEADERS });
}

export async function POST(request: Request) {
  const signingKey = process.env.DATA_ARCHIVE_RECEIPT_SIGNING_KEY?.trim();
  if (!signingKey) {
    return response({ ok: false, error: "Backup receipt service is not configured." }, 503);
  }
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_RECEIPT_BODY_BYTES) {
    return response({ ok: false, error: "Backup receipt is too large." }, 413);
  }

  let value: unknown;
  try {
    const body = await request.text();
    if (Buffer.byteLength(body, "utf8") > MAX_RECEIPT_BODY_BYTES) {
      return response({ ok: false, error: "Backup receipt is too large." }, 413);
    }
    value = JSON.parse(body);
  } catch {
    return response({ ok: false, error: "Backup receipt is invalid." }, 400);
  }

  try {
    if (
      value !== null &&
      typeof value === "object" &&
      "payload" in value &&
      value.payload !== null &&
      typeof value.payload === "object" &&
      "receiptKind" in value.payload &&
      value.payload.receiptKind === "package-restore-verification"
    ) {
      const receipt = authenticatePackageVerificationReceipt({ value, signingKey });
      const result = await persistPackageVerificationReceipt(receipt);
      return response({ ok: true, replayed: result.replayed });
    }
    const receipt = authenticateBackupReceipt({ value, signingKey });
    const result = await persistBackupReceipt(receipt);
    if (!result.replayed) {
      for (const alert of buildBackupReceiptAlerts(receipt.payload)) {
        await enqueueOperationalAlert(alert);
      }
    }
    return response({ ok: true, replayed: result.replayed });
  } catch (error) {
    if (error instanceof DataArchiveReceiptError) {
      return response({ ok: false, error: error.message }, error.status);
    }
    logError("Data archive receipt failed", error);
    return response({ ok: false, error: "Backup receipt could not be recorded." }, 500);
  }
}
