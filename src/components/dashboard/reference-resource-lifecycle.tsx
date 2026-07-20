"use client";

import { HistoryIcon, RotateCcwIcon, ShieldCheckIcon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type {
  ReferenceResourceCandidateResult,
  ReferenceResourceKey,
  ReferenceResourceVersionSummary,
} from "@/lib/reference-resources/types";

type CandidateDetails = {
  findings: Array<{ id: string; severity: string; ruleCode: string; message: string }>;
  diff: unknown;
};

type HistoryPayload = {
  versions: ReferenceResourceVersionSummary[];
  activationHistory: Array<{
    id: string;
    action: string;
    actorOwnerId: string;
    reason: string;
    createdAt: string;
  }>;
};

export function ReferenceResourceLifecycle({
  resourceKey,
  activeVersion,
  candidate,
}: {
  resourceKey: ReferenceResourceKey;
  activeVersion: ReferenceResourceVersionSummary;
  candidate: ReferenceResourceCandidateResult | null;
}) {
  const [reason, setReason] = useState("");
  const [history, setHistory] = useState<HistoryPayload | null>(null);
  const [candidateDetails, setCandidateDetails] = useState<CandidateDetails | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    fetch(`/api/reference-resources/${resourceKey}/versions`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load version history.");
        return (await response.json()) as HistoryPayload;
      })
      .then((payload) => {
        if (!cancelled) setHistory(payload);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load version history.");
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, resourceKey]);

  useEffect(() => {
    if (!candidate || candidate.unchanged) {
      setCandidateDetails(null);
      return;
    }
    const versionId = candidate.version.id;
    let cancelled = false;
    Promise.all([
      fetch(`/api/reference-resources/${resourceKey}/versions/${versionId}/findings`).then(
        async (response) => {
          if (!response.ok) throw new Error("Could not load validation findings.");
          return (await response.json()) as Pick<CandidateDetails, "findings">;
        },
      ),
      fetch(`/api/reference-resources/${resourceKey}/versions/${versionId}/diff`).then(
        async (response) => {
          if (!response.ok) throw new Error("Could not load candidate diff.");
          return (await response.json()) as Pick<CandidateDetails, "diff">;
        },
      ),
    ])
      .then(([findings, diff]) => {
        if (!cancelled) setCandidateDetails({ findings: findings.findings ?? [], diff: diff.diff });
      })
      .catch(() => {
        if (!cancelled) setError("Could not load complete candidate review details.");
      });
    return () => {
      cancelled = true;
    };
  }, [candidate, resourceKey]);

  async function mutate(url: string, body: Record<string, unknown>) {
    if (isSaving) return;
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Reference resource update failed.");
      }
      window.location.reload();
    } catch (mutationError) {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "Reference resource update failed.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  const reviewCandidate = candidate && !candidate.unchanged ? candidate.version : null;
  const validCandidate = reviewCandidate?.lifecycleState === "valid" ? reviewCandidate : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Badge variant="outline">Active v{activeVersion.versionNumber}</Badge>
        <span>Retrieved {new Date(activeVersion.sourceRetrievedAt).toLocaleString()}</span>
        <span className="font-mono text-xs">{activeVersion.contentChecksum?.slice(0, 12)}</span>
      </div>

      {reviewCandidate ? (
        <div
          data-smoke-surface="reference-resource-candidate"
          data-smoke-ready="reference-resource-candidate"
          className="space-y-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-medium">
                Version {reviewCandidate.versionNumber} {validCandidate ? "is ready for review" : "failed validation"}
              </p>
              <p className="text-sm text-muted-foreground">
                {reviewCandidate.entryCount.toLocaleString()} entries · {reviewCandidate.contentChecksum?.slice(0, 12)}
              </p>
            </div>
            <Badge variant={validCandidate ? "secondary" : "destructive"}>
              {validCandidate ? "Validated candidate" : "Invalid candidate"}
            </Badge>
          </div>
          <pre className="overflow-auto rounded-md bg-muted p-3 text-xs">
            {JSON.stringify(candidateDetails?.diff ?? reviewCandidate.diffSummary, null, 2)}
          </pre>
          {candidateDetails?.findings?.length ? (
            <div className="space-y-2 rounded-md border p-3">
              <p className="text-sm font-medium">Validation findings</p>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {candidateDetails.findings.map((finding) => (
                  <li key={finding.id}>
                    <Badge variant="outline">{finding.severity}</Badge>{" "}
                    {finding.ruleCode}: {finding.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <Input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Reason for activation or rejection"
            aria-label="Lifecycle reason"
          />
          {validCandidate ? <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={isSaving || reason.trim().length < 3}
              onClick={() =>
                mutate(
                  `/api/reference-resources/${resourceKey}/versions/${validCandidate.id}/activate`,
                  { expectedActiveVersionId: activeVersion.id, reason },
                )
              }
            >
              <ShieldCheckIcon /> Activate candidate
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isSaving || reason.trim().length < 3}
              onClick={() =>
                mutate(
                  `/api/reference-resources/${resourceKey}/versions/${validCandidate.id}/reject`,
                  { reason },
                )
              }
            >
              <XIcon /> Reject
            </Button>
          </div> : null}
        </div>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger
          render={<Button type="button" variant="outline" size="sm" />}
          data-smoke-trigger="reference-resource-history"
        >
          <HistoryIcon /> Version history
        </DialogTrigger>
        <DialogContent
          data-smoke-surface="reference-resource-history"
          data-smoke-ready="reference-resource-history"
          className="max-w-3xl"
        >
          <DialogHeader>
            <DialogTitle>Reference resource history</DialogTitle>
            <DialogDescription>
              Immutable versions remain available for audit and controlled rollback.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[55vh] space-y-2 overflow-y-auto p-4">
            {history?.versions.map((version) => (
              <div key={version.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                <div>
                  <p className="font-medium">
                    Version {version.versionNumber} {version.isActive ? "· Active" : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(version.createdAt).toLocaleString()} · {version.lifecycleState} · {version.contentChecksum?.slice(0, 12)}
                  </p>
                </div>
                {!version.isActive && version.lifecycleState === "valid" ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isSaving || reason.trim().length < 3}
                    onClick={() =>
                      mutate(
                        `/api/reference-resources/${resourceKey}/versions/${version.id}/rollback`,
                        { expectedActiveVersionId: activeVersion.id, reason },
                      )
                    }
                  >
                    <RotateCcwIcon /> Roll back
                  </Button>
                ) : null}
              </div>
            )) ?? <p className="text-sm text-muted-foreground">Loading history…</p>}
          </div>
          <DialogFooter>
            <Input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Reason required for rollback"
              aria-label="History action reason"
            />
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
