import { mkdir, open, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import {
  sendOperationalAlertEmail,
  type OperationalAlertEmailInput,
} from "@/lib/operational-alert-email";
import { archiveFetch, type ArchiveFetch } from "./http-client";

const DIRECT_ALERT_COOLDOWN_MS = 60 * 60 * 1000;
const DIRECT_ALERT_DAILY_BUDGET = 6;

type DirectAlertState = {
  date: string;
  sent: number;
  fingerprints: Record<string, string>;
};

export type ArchiveDirectAlertKind =
  | "backup-failed"
  | "receipt-unavailable"
  | "integrity-failed"
  | "missed-run"
  | "rehydration-failed"
  | "prune-failed";

export type ArchiveDirectAlertCredentialFiles = {
  apiKey: string;
  sender: string;
  recipient: string;
  detailsUrl: string;
};

const ALERT_COPY: Record<
  ArchiveDirectAlertKind,
  Pick<OperationalAlertEmailInput, "severity" | "title" | "summary">
> = {
  "backup-failed": {
    severity: "critical",
    title: "Samson data backup failed",
    summary:
      "The scheduled single-site recovery backup did not produce a verified recovery point. Review the protected Samson service logs.",
  },
  "receipt-unavailable": {
    severity: "critical",
    title: "Samson backup receipt could not be delivered",
    summary:
      "A local recovery run completed, but the application could not record its signed receipt. Production pruning remains unavailable.",
  },
  "integrity-failed": {
    severity: "critical",
    title: "Samson archive integrity failed",
    summary:
      "A bounded archive integrity check failed. Retention garbage collection and production pruning must remain stopped.",
  },
  "missed-run": {
    severity: "high",
    title: "Samson scheduled backup was missed",
    summary:
      "No verified recovery point completed after the scheduled 2:00 AM Pacific run. Review the protected Samson service and timer.",
  },
  "rehydration-failed": {
    severity: "critical",
    title: "Samson archive rehydration failed",
    summary:
      "A selected cold package could not be restored and verified. No consumer-visible target was changed.",
  },
  "prune-failed": {
    severity: "critical",
    title: "Supabase archive pruning failed",
    summary:
      "An approved narrow prune did not complete. Recorded per-item state remains retryable and the package was not marked fully cold.",
  },
};

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function readState(path: string, now: Date): Promise<DirectAlertState> {
  try {
    const parsed = JSON.parse(await readFile(path, "utf8")) as DirectAlertState;
    if (parsed.date === dateKey(now)) return parsed;
  } catch {
    // Missing or malformed local rate state safely starts a fresh daily budget.
  }
  return { date: dateKey(now), sent: 0, fingerprints: {} };
}

async function writeState(path: string, state: DirectAlertState): Promise<void> {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.tmp`;
  await writeFile(temporary, `${JSON.stringify(state)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  await rename(temporary, path);
}

export function buildArchiveDirectAlert(input: {
  kind: ArchiveDirectAlertKind;
  runKey: string;
  occurredAt: Date;
}): OperationalAlertEmailInput {
  const safeRunKey = /^[A-Za-z0-9._:-]{8,120}$/.test(input.runKey)
    ? input.runKey.toLowerCase()
    : "run-invalid";
  return {
    idempotencyKey: `data-archive:${input.kind}:${safeRunKey}`.slice(0, 200),
    source: "data.archive.direct",
    occurredAt: input.occurredAt.toISOString(),
    ...ALERT_COPY[input.kind],
  };
}

export async function sendArchiveDirectAlert(input: {
  kind: ArchiveDirectAlertKind;
  runKey: string;
  statePath: string;
  occurredAt?: Date;
  send?: typeof sendOperationalAlertEmail;
  fetchImpl?: ArchiveFetch;
  credentialFiles?: ArchiveDirectAlertCredentialFiles;
}): Promise<{ sent: boolean; reason?: "cooldown" | "daily-budget" }> {
  const now = input.occurredAt ?? new Date();
  await mkdir(dirname(input.statePath), { recursive: true, mode: 0o700 });
  const lock = await open(`${input.statePath}.lock`, "wx", 0o600).catch((error) => {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new Error("archive_direct_alert_lock_busy");
    }
    throw error;
  });
  try {
    const state = await readState(input.statePath, now);
    const fingerprint = input.kind;
    const lastSent = state.fingerprints[fingerprint]
      ? new Date(state.fingerprints[fingerprint]).getTime()
      : 0;
    if (now.getTime() - lastSent < DIRECT_ALERT_COOLDOWN_MS) {
      return { sent: false, reason: "cooldown" };
    }
    if (state.sent >= DIRECT_ALERT_DAILY_BUDGET) {
      return { sent: false, reason: "daily-budget" };
    }
    const alert = buildArchiveDirectAlert({
      kind: input.kind,
      runKey: input.runKey,
      occurredAt: now,
    });
    if (input.send) {
      await input.send(alert);
    } else if (input.credentialFiles) {
      const [apiKey, sender, recipient] = await Promise.all([
        readFile(input.credentialFiles.apiKey, "utf8"),
        readFile(input.credentialFiles.sender, "utf8"),
        readFile(input.credentialFiles.recipient, "utf8"),
      ]);
      await sendOperationalAlertEmail(alert, {
        environment: {
          RESEND_OPERATIONAL_API_KEY: apiKey.trim(),
          OPERATIONAL_ALERT_FROM: sender.trim(),
          OPERATIONAL_ALERT_RECIPIENT: recipient.trim(),
          OPERATIONAL_ALERT_DETAILS_URL: input.credentialFiles.detailsUrl,
        },
        fetchImpl: (input.fetchImpl ?? archiveFetch) as unknown as typeof fetch,
      });
    } else {
      await sendOperationalAlertEmail(alert);
    }
    state.sent += 1;
    state.fingerprints[fingerprint] = now.toISOString();
    await writeState(input.statePath, state);
    return { sent: true };
  } finally {
    await lock.close();
    await import("node:fs/promises").then(({ unlink }) =>
      unlink(`${input.statePath}.lock`).catch(() => undefined),
    );
  }
}

function pacificDateParts(date: Date): { date: string; offset: string } {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZoneName: "longOffset",
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value]),
  );
  const offset = (parts.timeZoneName ?? "GMT-08:00").replace("GMT", "");
  return { date: `${parts.year}-${parts.month}-${parts.day}`, offset };
}

export function isArchiveRunMissed(input: {
  now: Date;
  lastVerifiedAt: Date | null;
  graceHours?: number;
}): boolean {
  const { date, offset } = pacificDateParts(input.now);
  const scheduledAt = new Date(`${date}T02:00:00${offset}`);
  const deadline = new Date(
    scheduledAt.getTime() + (input.graceHours ?? 6) * 60 * 60 * 1000,
  );
  if (input.now < deadline) return false;
  return !input.lastVerifiedAt || input.lastVerifiedAt < scheduledAt;
}
