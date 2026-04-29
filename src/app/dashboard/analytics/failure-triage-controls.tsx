"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  ANALYTICS_FAILURE_TRIAGE_STATUS_LABELS,
  ANALYTICS_FAILURE_TRIAGE_STATUSES,
  type AnalyticsFailureTriageStatus,
} from "@/lib/analytics-failure-triage";
import { cn } from "@/lib/utils";

type FailureTriageControlsProps = {
  fingerprint: string;
  status: AnalyticsFailureTriageStatus;
  note: string;
};

async function getErrorMessage(response: Response) {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error || "Could not update analytics failure triage.";
  } catch {
    return "Could not update analytics failure triage.";
  }
}

export function FailureTriageControls({
  fingerprint,
  status,
  note,
}: FailureTriageControlsProps) {
  const router = useRouter();
  const [selectedStatus, setSelectedStatus] =
    useState<AnalyticsFailureTriageStatus>(status);
  const [draftNote, setDraftNote] = useState(note);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit() {
    setMessage(null);
    setError(null);
    setIsSaving(true);

    try {
      const response = await fetch("/api/admin/analytics/failure-triage", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fingerprint,
          status: selectedStatus,
          note: draftNote,
        }),
      });

      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      setMessage("Triage updated.");
      startTransition(() => {
        router.refresh();
      });
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Could not update analytics failure triage.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="mt-3 grid gap-2 rounded-lg border border-border/70 bg-muted/30 p-3">
      <div className="grid gap-2 sm:grid-cols-[minmax(10rem,14rem)_1fr_auto] sm:items-start">
        <label className="grid gap-1 text-xs font-medium text-muted-foreground">
          Status
          <select
            value={selectedStatus}
            onChange={(event) =>
              setSelectedStatus(event.target.value as AnalyticsFailureTriageStatus)
            }
            className="h-9 rounded-lg border border-border bg-background px-2 text-sm text-foreground"
          >
            {ANALYTICS_FAILURE_TRIAGE_STATUSES.map((triageStatus) => (
              <option key={triageStatus} value={triageStatus}>
                {ANALYTICS_FAILURE_TRIAGE_STATUS_LABELS[triageStatus]}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-medium text-muted-foreground">
          Note
          <textarea
            value={draftNote}
            maxLength={500}
            onChange={(event) => setDraftNote(event.target.value)}
            className="min-h-9 rounded-lg border border-border bg-background px-2 py-2 text-sm text-foreground"
          />
        </label>
        <Button
          type="button"
          size="sm"
          className="self-end"
          disabled={isSaving || isPending}
          onClick={() => {
            void handleSubmit();
          }}
        >
          Save
        </Button>
      </div>
      {message || error ? (
        <p
          className={cn(
            "text-xs",
            error ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {error ?? message}
        </p>
      ) : null}
    </div>
  );
}
