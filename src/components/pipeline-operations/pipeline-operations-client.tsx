"use client";

import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  Clock3Icon,
  HistoryIcon,
  Loader2Icon,
  PlayIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  ShieldAlertIcon,
} from "lucide-react";
import { useMemo, useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getPipelineRunDiagnostics } from "@/lib/pipeline-operations/diagnostics";
import type {
  PipelineFlowDefinition,
  PipelineRunDetail,
  PipelineRunSummary,
  PipelineScheduleState,
} from "@/lib/pipeline-operations/types";
import { cn } from "@/lib/utils";

type Props = {
  definitions: PipelineFlowDefinition[];
  initialRuns: PipelineRunSummary[];
  initialSchedules: PipelineScheduleState[];
  availableEffectKeys: string[];
};

function statusLabel(status: PipelineRunSummary["status"]) {
  return {
    queued: "Queued",
    running: "Running",
    awaiting_review: "Review Required",
    succeeded: "Up To Date",
    failed: "Failed",
    cancelled: "Cancelled",
  }[status];
}

function statusVariant(status: PipelineRunSummary["status"]) {
  if (status === "failed") return "destructive" as const;
  if (status === "succeeded") return "secondary" as const;
  return "outline" as const;
}

function formatDate(value: string | null) {
  if (!value) return "Not started";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function duration(run: PipelineRunSummary) {
  if (!run.startedAt) return "—";
  const end = run.completedAt ? new Date(run.completedAt).getTime() : Date.now();
  const seconds = Math.max(0, Math.round((end - new Date(run.startedAt).getTime()) / 1000));
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

async function jsonRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? "Request failed.");
  return body;
}

export function PipelineOperationsClient({
  definitions,
  initialRuns,
  initialSchedules,
  availableEffectKeys,
}: Props) {
  const [runs, setRuns] = useState(initialRuns);
  const [selectedDefinitionKey, setSelectedDefinitionKey] = useState(
    definitions[0]?.key ?? "",
  );
  const [selectedRun, setSelectedRun] = useState<PipelineRunDetail | null>(null);
  const [reviewReason, setReviewReason] = useState("");
  const [acknowledgeWarnings, setAcknowledgeWarnings] = useState(false);
  const [backfillInputs, setBackfillInputs] = useState("{}");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const effects = useMemo(() => new Set(availableEffectKeys), [availableEffectKeys]);
  const selectedDefinition = definitions.find(
    (definition) => definition.key === selectedDefinitionKey,
  );
  const selectedDefinitionReady = Boolean(
    selectedDefinition?.stages.every(
      (stage) => stage.kind === "review" || effects.has(stage.effectKey),
    ),
  );
  const scheduleByDefinition = new Map(
    initialSchedules.map((schedule) => [schedule.definitionKey, schedule]),
  );

  async function refreshRuns(selectRunId?: string) {
    const body = await jsonRequest<{ runs: PipelineRunSummary[] }>(
      "/api/admin/pipeline-operations/runs",
    );
    setRuns(body.runs);
    if (selectRunId) await openRun(selectRunId);
  }

  async function openRun(runId: string) {
    const body = await jsonRequest<{ run: PipelineRunDetail }>(
      `/api/admin/pipeline-operations/runs/${runId}`,
    );
    setSelectedRun(body.run);
  }

  function perform(action: () => Promise<void>) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        await action();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Request failed.");
      }
    });
  }

  function launch() {
    if (!selectedDefinition) return;
    perform(async () => {
      const body = await jsonRequest<{ run: PipelineRunDetail }>(
        "/api/admin/pipeline-operations/runs",
        {
          method: "POST",
          body: JSON.stringify({
            definitionKey: selectedDefinition.key,
            launchKind: "manual",
            requestId: crypto.randomUUID(),
          }),
        },
      );
      setMessage("Pipeline accepted. Its first bounded stage is running in the background.");
      setSelectedRun(body.run);
      await refreshRuns();
    });
  }

  function launchBackfill() {
    if (!selectedDefinition) return;
    perform(async () => {
      const exactInputs = JSON.parse(backfillInputs) as Record<string, unknown>;
      const body = await jsonRequest<{ run: PipelineRunDetail }>(
        "/api/admin/pipeline-operations/backfills",
        {
          method: "POST",
          body: JSON.stringify({
            definitionKey: selectedDefinition.key,
            requestId: crypto.randomUUID(),
            exactInputs,
          }),
        },
      );
      setMessage("Historical backfill accepted with its exact input identifiers pinned.");
      setSelectedRun(body.run);
      await refreshRuns();
    });
  }

  function review(decision: "approve" | "reject") {
    if (!selectedRun?.currentStageKey || reviewReason.trim().length < 3) return;
    perform(async () => {
      await jsonRequest(
        `/api/admin/pipeline-operations/runs/${selectedRun.id}/review`,
        {
          method: "POST",
          body: JSON.stringify({
            stageKey: selectedRun.currentStageKey,
            decision,
            reason: reviewReason,
            acknowledgeWarnings,
          }),
        },
      );
      setReviewReason("");
      setAcknowledgeWarnings(false);
      setMessage(decision === "approve" ? "Review approved." : "Review rejected.");
      await refreshRuns(selectedRun.id);
    });
  }

  function retry() {
    if (!selectedRun?.currentStageKey) return;
    perform(async () => {
      await jsonRequest(
        `/api/admin/pipeline-operations/runs/${selectedRun.id}/retry`,
        {
          method: "POST",
          body: JSON.stringify({
            stageKey: selectedRun.currentStageKey,
            reason: reviewReason.trim() || "Retry after administrator review",
          }),
        },
      );
      setMessage("Retry accepted.");
      await refreshRuns(selectedRun.id);
    });
  }

  function continueRun() {
    if (!selectedRun) return;
    perform(async () => {
      await jsonRequest(
        `/api/admin/pipeline-operations/runs/${selectedRun.id}/continue`,
        { method: "POST" },
      );
      setMessage("Continuation accepted. The run will advance to its next review or terminal state.");
      await refreshRuns(selectedRun.id);
    });
  }

  function rebuild() {
    if (!selectedRun) return;
    perform(async () => {
      const body = await jsonRequest<{ run: PipelineRunDetail }>(
        `/api/admin/pipeline-operations/runs/${selectedRun.id}/rebuild`,
        {
          method: "POST",
          body: JSON.stringify({ requestId: crypto.randomUUID() }),
        },
      );
      setSelectedRun(body.run);
      setMessage("A new immutable run was created with current resources.");
      await refreshRuns();
    });
  }

  const diagnostics = selectedRun ? getPipelineRunDiagnostics(selectedRun) : [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Run pipeline</CardTitle>
          <CardDescription>
            Launch a code-defined flow. Every run pins exact connections,
            resources, rules, and current publications before work starts.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <label className="space-y-1 text-sm font-medium">
              Flow
              <select
                className="h-9 w-full rounded-lg border border-input bg-background px-3"
                value={selectedDefinitionKey}
                onChange={(event) => setSelectedDefinitionKey(event.target.value)}
                data-smoke-pipeline-flow
              >
                {definitions.map((definition) => (
                  <option key={definition.key} value={definition.key}>
                    {definition.label}
                  </option>
                ))}
              </select>
            </label>
            <Button
              onClick={launch}
              disabled={isPending || !selectedDefinitionReady}
              data-smoke-pipeline-launch
            >
              {isPending ? <Loader2Icon className="animate-spin" /> : <PlayIcon />}
              Run pipeline
            </Button>
          </div>
          {selectedDefinition ? (
            <div className="rounded-lg border p-3 text-sm">
              <p className="font-medium">{selectedDefinition.description}</p>
              <p className="mt-1 text-muted-foreground">
                {selectedDefinition.stages.length} durable stages · definition {selectedDefinition.version}
              </p>
              {!selectedDefinitionReady ? (
                <p className="mt-2 flex items-center gap-2 text-amber-700 dark:text-amber-300">
                  <ShieldAlertIcon className="size-4" />
                  This flow remains disabled until all downstream stage adapters are deployed.
                </p>
              ) : null}
              {scheduleByDefinition.get(selectedDefinition.key)?.enabled ? (
                <p className="mt-2 text-muted-foreground">Schedule enabled after a verified manual canary.</p>
              ) : null}
            </div>
          ) : null}
          <details className="rounded-lg border p-3">
            <summary className="cursor-pointer font-medium">Historical backfill</summary>
            <p className="mt-2 text-sm text-muted-foreground">
              Provide exact UUID bindings and, for release members, their retained
              SHA-256 checksums. Nested connection, publication, Tier 2, and
              Aggregate 2 selections are supported; current or latest aliases are rejected.
            </p>
            <textarea
              aria-label="Exact historical inputs"
              className="mt-3 min-h-28 w-full rounded-lg border border-input bg-background p-3 font-mono text-xs"
              value={backfillInputs}
              onChange={(event) => setBackfillInputs(event.target.value)}
            />
            <Button className="mt-3" variant="outline" onClick={launchBackfill} disabled={isPending}>
              <HistoryIcon /> Run exact backfill
            </Button>
          </details>
          {message ? <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{message}</p> : null}
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        </CardContent>
      </Card>

      <Card data-smoke-pipeline-history>
        <CardHeader>
          <CardTitle>Run history</CardTitle>
          <CardDescription>
            Operational history only: exact inputs, stages, attempts, findings,
            review gates, outputs, and failures.
          </CardDescription>
          <CardAction>
            <Button variant="outline" size="sm" onClick={() => perform(() => refreshRuns())} disabled={isPending}>
              <RefreshCwIcon className={cn(isPending && "animate-spin")} /> Refresh
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Flow</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Rows</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Started</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((run) => {
                const definition = definitions.find((item) => item.key === run.definitionKey);
                return (
                  <TableRow key={run.id}>
                    <TableCell>
                      <button
                        type="button"
                        className="text-left font-medium underline-offset-4 hover:underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() => perform(() => openRun(run.id))}
                        data-smoke-trigger="pipeline-run-detail"
                      >
                        {definition?.label ?? run.definitionKey}
                      </button>
                      <p className="text-xs text-muted-foreground">{run.launchKind}</p>
                    </TableCell>
                    <TableCell><Badge variant={statusVariant(run.status)}>{statusLabel(run.status)}</Badge></TableCell>
                    <TableCell className="font-mono text-xs">{run.currentStageKey ?? "—"}</TableCell>
                    <TableCell>{run.completedStageCount}/{run.stageCount}</TableCell>
                    <TableCell>{run.rowCount ?? "—"}</TableCell>
                    <TableCell>{duration(run)}</TableCell>
                    <TableCell>{formatDate(run.createdAt)}</TableCell>
                  </TableRow>
                );
              })}
              {runs.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">No pipeline runs yet.</TableCell></TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Sheet open={Boolean(selectedRun)} onOpenChange={(open) => !open && setSelectedRun(null)}>
        <SheetContent
          side="right"
          className="w-full data-[side=right]:sm:max-w-none data-[side=right]:md:w-1/2"
          data-smoke-surface="pipeline-run-detail"
          data-smoke-ready="pipeline-run-detail"
        >
          {selectedRun ? (
            <>
              <SheetHeader className="border-b pr-14">
                <SheetTitle className="text-xl">Run detail</SheetTitle>
                <SheetDescription>
                  {definitions.find((item) => item.key === selectedRun.definitionKey)?.label ?? selectedRun.definitionKey}
                  {" · "}{formatDate(selectedRun.createdAt)}
                </SheetDescription>
              </SheetHeader>
              <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={statusVariant(selectedRun.status)}>{statusLabel(selectedRun.status)}</Badge>
                  <span className="font-mono text-xs text-muted-foreground">{selectedRun.correlationId}</span>
                  {selectedRun.outOfDate ? <Badge variant="outline">Out of date</Badge> : null}
                </div>

                {diagnostics.length > 0 ? (
                  <section className="space-y-2" aria-label="Diagnostics">
                    <h3 className="font-heading text-lg font-medium">Diagnostics</h3>
                    {diagnostics.map((diagnostic) => (
                      <div key={`${diagnostic.code}:${diagnostic.stageKey}`} className="rounded-lg border p-3">
                        <div className="flex items-center gap-2 font-medium">
                          {diagnostic.severity === "error" ? <AlertTriangleIcon className="size-4 text-destructive" /> : <Clock3Icon className="size-4" />}
                          {diagnostic.title}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{diagnostic.message}</p>
                        {diagnostic.recovery ? <p className="mt-2 text-sm">{diagnostic.recovery}</p> : null}
                      </div>
                    ))}
                  </section>
                ) : null}

                <section
                  className="space-y-2"
                  data-smoke-pipeline-stage-timeline
                >
                  <h3 className="font-heading text-lg font-medium">Stage timeline</h3>
                  {selectedRun.stages.map((stage) => (
                    <div key={stage.id} className="rounded-lg border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-medium">{stage.key}</p>
                          <p className="text-xs text-muted-foreground">{stage.kind} · {stage.effectKey}</p>
                        </div>
                        <Badge variant={stage.status === "failed" ? "destructive" : "outline"}>{stage.status.replaceAll("_", " ")}</Badge>
                      </div>
                      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                        <div><dt className="text-muted-foreground">Attempts</dt><dd>{stage.attemptCount}/{stage.maxAttempts}</dd></div>
                        <div><dt className="text-muted-foreground">Warnings</dt><dd>{String(stage.findingSummary.warningCount ?? 0)}</dd></div>
                        <div><dt className="text-muted-foreground">Errors</dt><dd>{String(stage.findingSummary.errorCount ?? 0)}</dd></div>
                      </dl>
                      {stage.errorMessage ? <p className="mt-3 text-sm text-destructive">{stage.errorMessage}</p> : null}
                      {stage.attempts.length > 0 ? (
                        <details
                          className="mt-3 text-sm"
                          data-smoke-pipeline-attempt-history
                        >
                          <summary className="cursor-pointer">Attempt history ({stage.attempts.length})</summary>
                          <ul className="mt-2 space-y-1 text-muted-foreground">
                            {stage.attempts.map((attempt) => (
                              <li key={attempt.id}>#{attempt.attemptNumber} · {attempt.status} · {formatDate(attempt.startedAt)}</li>
                            ))}
                          </ul>
                        </details>
                      ) : null}
                    </div>
                  ))}
                </section>

                <section className="space-y-2" data-smoke-pipeline-exact-inputs>
                  <h3 className="font-heading text-lg font-medium">Exact inputs</h3>
                  <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all rounded-lg border bg-muted/30 p-3 text-xs">
                    {JSON.stringify(selectedRun.exactInputs, null, 2)}
                  </pre>
                </section>

                <section className="space-y-3 border-t pt-4" aria-label="Recovery actions">
                  <Input
                    aria-label="Decision or retry reason"
                    placeholder="Reason for this action"
                    value={reviewReason}
                    onChange={(event) => setReviewReason(event.target.value)}
                    data-smoke-pipeline-reason
                  />
                  {selectedRun.status === "awaiting_review" && selectedRun.warningCount > 0 ? (
                    <label className="flex items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="mt-1 size-4"
                        checked={acknowledgeWarnings}
                        onChange={(event) => setAcknowledgeWarnings(event.target.checked)}
                        data-smoke-pipeline-warning-acknowledgement
                      />
                      <span>
                        I reviewed and acknowledge the candidate warnings before publication.
                      </span>
                    </label>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    {selectedRun.status === "queued" || selectedRun.status === "running" ? (
                      <Button
                        onClick={continueRun}
                        disabled={isPending}
                      >
                        <PlayIcon /> Continue run
                      </Button>
                    ) : null}
                    {selectedRun.status === "awaiting_review" ? (
                      <>
                        <Button
                          onClick={() => review("approve")}
                          disabled={
                            isPending ||
                            reviewReason.trim().length < 3 ||
                            (selectedRun.warningCount > 0 && !acknowledgeWarnings)
                          }
                          data-smoke-pipeline-review-approve
                        >
                          <CheckCircle2Icon /> Approve and continue
                        </Button>
                        <Button variant="destructive" onClick={() => review("reject")} disabled={isPending || reviewReason.trim().length < 3}>
                          Reject
                        </Button>
                      </>
                    ) : null}
                    {selectedRun.status === "failed" ? (
                      <Button
                        onClick={retry}
                        disabled={isPending}
                        data-smoke-pipeline-retry
                      >
                        <RotateCcwIcon /> Retry failed stage
                      </Button>
                    ) : null}
                    <Button variant="outline" onClick={rebuild} disabled={isPending}><RefreshCwIcon /> Rebuild with current resources</Button>
                  </div>
                </section>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
