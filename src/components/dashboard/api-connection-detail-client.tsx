"use client";

import {
  CheckCircle2Icon,
  CopyIcon,
  DatabaseIcon,
  DownloadIcon,
  ExternalLinkIcon,
  FileSpreadsheetIcon,
  Loader2Icon,
  PlayIcon,
  RefreshCcwIcon,
  Settings2Icon,
  Trash2Icon,
  UploadCloudIcon,
  XCircleIcon,
} from "lucide-react";
import {
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type RowSelectionState,
  type SortingState,
} from "@tanstack/react-table";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { GoogleSheetsHeaderSelection } from "@/components/dashboard/google-sheets-header-selection";
import { DataGrid, DataGridContainer } from "@/components/reui/data-grid/data-grid";
import { DataGridColumnHeader } from "@/components/reui/data-grid/data-grid-column-header";
import { DataGridScrollArea } from "@/components/reui/data-grid/data-grid-scroll-area";
import { DataGridTable } from "@/components/reui/data-grid/data-grid-table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type {
  ApiConnection,
  ApiConnectionRun,
  ApiConnectionRunDetailResponse,
  ApiConnectionRunResponse,
  ApiConnectionRunsResponse,
  ApiConnectionRunStatus,
  GoogleSheetsConnectionAccessCheckResponse,
  GoogleSheetsConnectionProviderConfig,
  GoogleSheetsHeaderPreview,
  GoogleSheetsHeaderPreviewResponse,
  GoogleSheetsHeaderSelectionInput,
  GoogleSheetsHeaderSelectionUpdateResponse,
} from "@/lib/api-types";
import { formatUtcTimestamp } from "@/lib/date-time";
import type {
  ImbFormingRun,
  ImbFormingRunResponse,
  ImbFormingRunsResponse,
} from "@/lib/imb-forming/types";
import { cn } from "@/lib/utils";

type ApiConnectionDetailClientProps = {
  connection: ApiConnection;
  initialRuns: ApiConnectionRun[];
  serviceAccountEmail: string | null;
};

type DetailMessage = {
  title: string;
  detail: string;
  tone: "success" | "error";
};

const RUN_HISTORY_VISIBLE_ROW_LIMIT = 5;
const RUN_HISTORY_SCROLL_AREA_HEIGHT = "h-[268px]";

async function getErrorMessage(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error || fallback;
  } catch {
    return fallback;
  }
}

function getGoogleSheetsProviderConfig(
  connection: ApiConnection,
): GoogleSheetsConnectionProviderConfig | null {
  return connection.provider === "google_sheets" &&
    connection.providerConfig?.provider === "google_sheets"
    ? connection.providerConfig
    : null;
}

function formatDuration(run: ApiConnectionRun) {
  if (run.status === "queued") {
    return "Queued";
  }

  if (run.status === "running") {
    return "In progress";
  }

  if (run.durationMs >= 1000) {
    return `${(run.durationMs / 1000).toFixed(1)} s`;
  }

  return `${run.durationMs} ms`;
}

function getRunLabel(run: ApiConnectionRun) {
  const mode = run.mode === "import" ? "Import" : "Test";

  if (run.status === "queued") {
    return `${mode} queued`;
  }

  if (run.status === "running") {
    return `${mode} running`;
  }

  return `${mode} ${run.status === "success" ? "passed" : "failed"}`;
}

function getModeLabel(run: ApiConnectionRun) {
  return run.mode === "import" ? "Import" : "Test";
}

function statusBadgeClass(status: ApiConnectionRunStatus) {
  if (status === "success") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }

  if (status === "queued") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  }

  if (status === "running") {
    return "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300";
  }

  return "border-destructive/30 bg-destructive/10 text-destructive";
}

function isRunActive(run: ApiConnectionRun) {
  return run.status === "queued" || run.status === "running";
}

function sortRuns(runs: ApiConnectionRun[]) {
  return [...runs].sort(
    (first, second) =>
      new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime(),
  );
}

function mergeRun(current: ApiConnectionRun[], next: ApiConnectionRun) {
  return sortRuns([next, ...current.filter((run) => run.id !== next.id)]);
}

function mergeRuns(current: ApiConnectionRun[], nextRuns: ApiConnectionRun[]) {
  const byId = new Map(current.map((run) => [run.id, run]));

  for (const run of nextRuns) {
    byId.set(run.id, run);
  }

  return sortRuns([...byId.values()]);
}

function getRunDownloadUrl(run: ApiConnectionRun, format: "json" | "csv") {
  return `/api/admin/api-connections/${run.connectionId}/runs/${run.id}/download?format=${format}`;
}

function RunDownloadLinks({
  run,
  size = "sm",
}: {
  run: ApiConnectionRun;
  size?: "xs" | "sm";
}) {
  if (!run.output) {
    return null;
  }

  const className =
    size === "xs"
      ? cn(buttonVariants({ variant: "outline", size: "sm" }), "h-7 px-2 text-xs")
      : buttonVariants({ variant: "outline", size: "sm" });

  return (
    <div className="flex flex-wrap gap-2">
      <a href={getRunDownloadUrl(run, "json")} className={className}>
        <DownloadIcon className="size-3.5" />
        JSON
      </a>
      <a href={getRunDownloadUrl(run, "csv")} className={className}>
        <DownloadIcon className="size-3.5" />
        CSV
      </a>
    </div>
  );
}

function ArtifactCell({ run }: { run: ApiConnectionRun }) {
  if (!run.output && !run.datasetId) {
    return <span className="text-muted-foreground">None</span>;
  }

  return (
    <div className="flex flex-wrap gap-2" onClick={(event) => event.stopPropagation()}>
      {run.output ? (
        <>
          <a
            href={getRunDownloadUrl(run, "json")}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-7 px-2 text-xs")}
          >
            JSON
          </a>
          <a
            href={getRunDownloadUrl(run, "csv")}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-7 px-2 text-xs")}
          >
            CSV
          </a>
        </>
      ) : null}
      {run.datasetId ? (
        <a
          href={`/dashboard/datasets/${run.datasetId}`}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-7 px-2 text-xs")}
        >
          Dataset
        </a>
      ) : null}
    </div>
  );
}

function getFormingStatusLabel(run: ImbFormingRun) {
  return {
    building: "Forming",
    valid: "Ready for review",
    invalid: "Needs correction",
    rejected: "Rejected",
    publishing: "Publishing",
    published: "Published",
    failed: "Build failed",
  }[run.status];
}

const FORMING_VALIDATION_DETAIL_LABELS = {
  inputRowCount: "Input rows",
  outputRowCount: "Output rows",
  missingStableKeyRows: "Missing stable-key rows",
  duplicateStableKeyRows: "Duplicate stable-key rows",
  duplicateDomainKeyRows: "Duplicate person-country rows",
  unresolvedCountryRows: "Unresolved country rows",
  ambiguousCountryRows: "Ambiguous country rows",
  countryConflictRows: "Country conflict rows",
  unresolvedRopRows: "Unresolved ROP rows",
  ropParentConflictRows: "ROP parent conflict rows",
  invalidValueCount: "Invalid source values",
  schemaDriftFields: "Unexpected source fields",
} as const;

function getFormingValidationDetails(run: ImbFormingRun) {
  const summary = run.validationSummary as Record<string, unknown>;
  return Object.entries(FORMING_VALIDATION_DETAIL_LABELS).flatMap(
    ([key, label]) => {
      const value = summary[key];
      if (typeof value === "number" && Number.isFinite(value)) {
        return [{ key, label, value: value.toLocaleString() }];
      }
      if (
        Array.isArray(value) &&
        value.every((entry) => typeof entry === "string")
      ) {
        return [{ key, label, value: value.length > 0 ? value.join(", ") : "None" }];
      }
      return [];
    },
  );
}

function CopyableMetadataValue({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <span className="flex min-w-0 items-center gap-1">
      <span
        className="min-w-0 flex-1 truncate font-mono leading-relaxed"
        title={value}
      >
        {value}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={`Copy ${label}`}
        title={`Copy ${label}`}
        onClick={() => void navigator.clipboard?.writeText(value)}
      >
        <CopyIcon />
      </Button>
    </span>
  );
}

function ImbFormingPanel({
  connectionId,
  sourceRun,
  profileLabel,
}: {
  connectionId: string;
  sourceRun: ApiConnectionRun;
  profileLabel: string;
}) {
  const [formingRuns, setFormingRuns] = useState<ImbFormingRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<"build" | "publish" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [warningsAcknowledged, setWarningsAcknowledged] = useState(false);
  const current = formingRuns[0] ?? null;
  const validationDetails = current
    ? getFormingValidationDetails(current)
    : [];
  const baseUrl = `/api/admin/api-connections/${connectionId}/runs/${sourceRun.id}/forming-candidates`;

  const load = useCallback(async () => {
    const response = await fetch(baseUrl);
    if (!response.ok) {
      throw new Error(
        await getErrorMessage(response, "Forming candidates could not be loaded."),
      );
    }
    const payload = (await response.json()) as ImbFormingRunsResponse;
    setFormingRuns(payload.formingRuns ?? []);
  }, [baseUrl]);

  useEffect(() => {
    let cancelled = false;
    void load()
      .catch((loadError) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Forming candidates could not be loaded.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  useEffect(() => {
    if (
      !current ||
      (current.status !== "building" && current.status !== "publishing")
    ) {
      return;
    }
    const interval = window.setInterval(() => {
      void load().catch(() => undefined);
    }, 1500);
    return () => window.clearInterval(interval);
  }, [current, load]);

  async function buildCandidate() {
    setBusyAction("build");
    setError(null);
    try {
      const response = await fetch(baseUrl, { method: "POST" });
      if (!response.ok) {
        throw new Error(
          await getErrorMessage(response, "Candidate build could not start."),
        );
      }
      const payload = (await response.json()) as ImbFormingRunResponse;
      setFormingRuns((runs) => [
        payload.formingRun,
        ...runs.filter((run) => run.id !== payload.formingRun.id),
      ]);
    } catch (buildError) {
      setError(
        buildError instanceof Error
          ? buildError.message
          : "Candidate build could not start.",
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function decide(action: "publish" | "reject") {
    if (!current) return;
    setBusyAction(action);
    setError(null);
    try {
      const response = await fetch(`${baseUrl}/${current.id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, warningsAcknowledged }),
      });
      if (!response.ok) {
        throw new Error(
          await getErrorMessage(response, "Candidate decision failed."),
        );
      }
      const payload = (await response.json()) as ImbFormingRunResponse;
      setFormingRuns((runs) => [
        payload.formingRun,
        ...runs.filter((run) => run.id !== payload.formingRun.id),
      ]);
      setReason("");
      setWarningsAcknowledged(false);
    } catch (decisionError) {
      setError(
        decisionError instanceof Error
          ? decisionError.message
          : "Candidate decision failed.",
      );
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <section
      className="space-y-4 rounded-lg border border-border bg-muted/20 p-4"
      data-smoke-surface="imb-forming-candidate-review"
      data-smoke-ready="imb-forming-candidate-review"
    >
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">Formed dataset candidate</h3>
        <p className="text-xs text-muted-foreground">
          Apply the pinned {current?.engineLabel ?? profileLabel} engine and
          resource rules to this archived source snapshot before publishing a
          dataset.
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <XCircleIcon className="size-4" />
          <AlertTitle>Candidate action failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2Icon className="size-4 animate-spin" /> Loading candidate history…
        </div>
      ) : current ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{getFormingStatusLabel(current)}</Badge>
            <span className="font-mono text-xs text-muted-foreground">
              {current.outputRowCount ?? current.inputRowCount} rows
            </span>
            <span className="text-xs text-muted-foreground">
              {current.warningCount} warnings · {current.errorCount} errors
            </span>
          </div>

          {validationDetails.length > 0 ? (
            <div className="space-y-2 rounded-md border border-border bg-background/60 p-3">
              <h4 className="text-xs font-semibold uppercase text-muted-foreground">
                Validation summary
              </h4>
              <dl className="grid gap-x-4 gap-y-2 text-xs sm:grid-cols-2">
                {validationDetails.map((detail) => (
                  <div key={detail.key} className="flex min-w-0 justify-between gap-3">
                    <dt className="text-muted-foreground">{detail.label}</dt>
                    <dd
                      className="min-w-0 truncate text-right font-mono"
                      title={detail.value}
                    >
                      {detail.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}

          <dl className="grid gap-2 text-xs sm:grid-cols-2">
            <div className="min-w-0">
              <dt className="text-muted-foreground">Reference set</dt>
              <dd>
                <CopyableMetadataValue
                  label="reference set"
                  value={current.resourceSetId}
                />
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-muted-foreground">Reference checksum</dt>
              <dd>
                <CopyableMetadataValue
                  label="reference checksum"
                  value={current.resourceSetChecksum}
                />
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-muted-foreground">Forming engine</dt>
              <dd className="truncate leading-relaxed" title={current.engineLabel}>
                {current.engineLabel} ({current.transformationVersion})
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-muted-foreground">Field contract</dt>
              <dd>
                <CopyableMetadataValue
                  label="field contract checksum"
                  value={current.fieldContractChecksum}
                />
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-muted-foreground">Transformation</dt>
              <dd className="space-y-1">
                <span className="block truncate" title={current.transformationVersion}>
                  {current.transformationVersion}
                </span>
                <CopyableMetadataValue
                  label="transformation checksum"
                  value={current.transformationChecksum}
                />
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-muted-foreground">Source checksum</dt>
              <dd>
                <CopyableMetadataValue
                  label="source checksum"
                  value={current.sourceRowsChecksum}
                />
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-muted-foreground">Output checksum</dt>
              <dd>
                <CopyableMetadataValue
                  label="output checksum"
                  value={current.outputChecksum ?? "Pending"}
                />
              </dd>
            </div>
            {current.resourceBindings.length > 0 ? (
              <div className="min-w-0 space-y-2 sm:col-span-2">
                <dt className="text-muted-foreground">Pinned resources</dt>
                <dd className="grid gap-2 sm:grid-cols-2">
                  {current.resourceBindings.map((binding) => (
                    <div
                      key={`${binding.position}-${binding.key}`}
                      className="min-w-0 space-y-2 rounded-md border border-border bg-background/60 p-3"
                    >
                      <div className="flex min-w-0 items-center justify-between gap-2">
                        <span
                          className="min-w-0 truncate font-medium"
                          title={binding.key}
                        >
                          {binding.key}
                        </span>
                        <Badge variant="outline" className="shrink-0 capitalize">
                          {binding.bindingType}
                        </Badge>
                      </div>
                      <div className="min-w-0">
                        <span className="text-muted-foreground">Version</span>
                        <CopyableMetadataValue
                          label={`${binding.key} version`}
                          value={binding.resourceVersionId ?? binding.version}
                        />
                      </div>
                      <div className="min-w-0">
                        <span className="text-muted-foreground">Checksum</span>
                        <CopyableMetadataValue
                          label={`${binding.key} checksum`}
                          value={binding.checksum}
                        />
                      </div>
                    </div>
                  ))}
                </dd>
              </div>
            ) : null}
            {current.publicationId ? (
              <div className="min-w-0 sm:col-span-2">
                <dt className="text-muted-foreground">Formed publication</dt>
                <dd>
                  <CopyableMetadataValue
                    label="formed publication"
                    value={current.publicationId}
                  />
                </dd>
              </div>
            ) : null}
            {current.downstreamIdentityRun ? (
              <div
                className="grid min-w-0 gap-3 rounded-lg border border-border bg-background/70 p-3 sm:col-span-2 sm:grid-cols-3"
                data-smoke-downstream-identity-lineage
              >
                <div className="min-w-0">
                  <dt className="text-muted-foreground">
                    Downstream identity run
                  </dt>
                  <dd className="break-all font-mono leading-relaxed">
                    <Link
                      href={`/admin/identity-registry?runId=${current.downstreamIdentityRun.runId}`}
                      className="underline underline-offset-4"
                      data-smoke-downstream-identity-run-link
                    >
                      {current.downstreamIdentityRun.runId}
                    </Link>
                    <span className="ml-2 font-sans text-muted-foreground">
                      ({current.downstreamIdentityRun.status})
                    </span>
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-muted-foreground">
                    Identity publication
                  </dt>
                  <dd className="break-all font-mono leading-relaxed">
                    {current.downstreamIdentityRun.publicationId ?? "Pending"}
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-muted-foreground">Registry revision</dt>
                  <dd className="break-all font-mono leading-relaxed">
                    {current.downstreamIdentityRun.registryRevisionId ?? "Pending"}
                  </dd>
                </div>
              </div>
            ) : null}
          </dl>

          {current.errorMessage ? (
            <Alert variant="destructive">
              <XCircleIcon className="size-4" />
              <AlertTitle>Candidate error</AlertTitle>
              <AlertDescription>{current.errorMessage}</AlertDescription>
            </Alert>
          ) : null}

          {current.findings.length > 0 ? (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase text-muted-foreground">
                Findings
              </h4>
              <div className="max-h-56 overflow-auto rounded-md border border-border">
                {current.findings.map((finding, index) => (
                  <div
                    key={`${finding.ruleCode}-${finding.sourceRowIndex ?? "all"}-${index}`}
                    className="border-b border-border p-3 text-xs last:border-0"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{finding.ruleCode}</span>
                      <Badge variant="outline" className="capitalize">
                        {finding.severity}
                      </Badge>
                    </div>
                    <p className="mt-1 text-muted-foreground">{finding.message}</p>
                    {finding.sourceRowIndex !== null ? (
                      <p className="mt-1 font-mono text-muted-foreground">
                        Source row {finding.sourceRowIndex + 1}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
              {current.findingsTruncated ? (
                <p className="text-xs text-muted-foreground">
                  Showing the first 250 findings. Download the full findings artifact
                  for the complete list.
                </p>
              ) : null}
            </div>
          ) : null}

          {current.artifactManifest.rows ? (
            <div className="flex flex-wrap gap-2">
              {(["csv", "findings", "manifest"] as const).map((kind) =>
                current.artifactManifest[kind] ? (
                  <a
                    key={kind}
                    href={`${baseUrl}/${current.id}/download?kind=${kind}`}
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    <DownloadIcon className="size-3.5" />
                    {kind === "csv"
                      ? "Formed CSV"
                      : kind[0].toUpperCase() + kind.slice(1)}
                  </a>
                ) : null,
              )}
            </div>
          ) : null}

          {current.status === "valid" || current.status === "invalid" ? (
            <div
              className="space-y-3 border-t border-border pt-4"
              data-smoke-surface="imb-forming-decision"
              data-smoke-ready="imb-forming-decision"
            >
              <label className="block space-y-1 text-xs font-medium">
                Decision reason
                <textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  maxLength={500}
                  className="mt-1 min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Record why this candidate is being published or rejected."
                />
              </label>
              {current.status === "valid" && current.warningCount > 0 ? (
                <label className="flex items-start gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={warningsAcknowledged}
                    onChange={(event) =>
                      setWarningsAcknowledged(event.target.checked)
                    }
                    className="mt-0.5"
                  />
                  I reviewed and accept the {current.warningCount} non-blocking
                  warnings.
                </label>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {current.status === "valid" ? (
                  <Button
                    size="sm"
                    onClick={() => void decide("publish")}
                    disabled={
                      !reason.trim() ||
                      busyAction !== null ||
                      (current.warningCount > 0 && !warningsAcknowledged)
                    }
                    data-smoke-trigger="imb-forming-decision"
                    data-smoke-forming-publish
                  >
                    {busyAction === "publish" ? (
                      <Loader2Icon className="size-4 animate-spin" />
                    ) : (
                      <CheckCircle2Icon className="size-4" />
                    )}
                    Publish dataset
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void decide("reject")}
                  disabled={!reason.trim() || busyAction !== null}
                  data-smoke-trigger="imb-forming-decision"
                >
                  Reject candidate
                </Button>
              </div>
            </div>
          ) : null}

          {current.status === "invalid" || current.status === "failed" ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => void buildCandidate()}
              disabled={busyAction !== null}
              data-smoke-trigger="imb-forming-candidate-review"
              data-smoke-forming-build
            >
              {busyAction === "build" ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : (
                <RefreshCcwIcon className="size-4" />
              )}
              Build with current resources
            </Button>
          ) : null}

          {current.datasetId ? (
            <a
              href={`/dashboard/datasets/${current.datasetId}`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <ExternalLinkIcon className="size-3.5" /> Open published dataset
            </a>
          ) : null}
        </div>
      ) : (
        <Button
          size="sm"
          onClick={() => void buildCandidate()}
          disabled={busyAction !== null}
          data-smoke-trigger="imb-forming-candidate-review"
          data-smoke-forming-build
        >
          {busyAction === "build" ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : (
            <Settings2Icon className="size-4" />
          )}
          Build formed candidate
        </Button>
      )}
    </section>
  );
}

function RunDetailSheet({
  connectionId,
  run,
  open,
  onOpenChange,
}: {
  connectionId: string;
  run: ApiConnectionRun | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open && run !== null} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 sm:max-w-[50vw]"
        data-smoke-surface="api-connection-run-detail-sheet"
        data-smoke-ready="api-connection-run-detail-sheet"
      >
        {run ? (
          <div className="flex h-full flex-col">
            <SheetHeader className="border-b border-border px-6 py-5">
              <SheetTitle>Run detail</SheetTitle>
              <SheetDescription>
                {getRunLabel(run)} initiated {formatUtcTimestamp(run.createdAt)}.
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 space-y-5 overflow-y-auto overscroll-contain px-6 py-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className={cn("capitalize", statusBadgeClass(run.status))}
                  >
                    {getRunLabel(run)}
                  </Badge>
                  <span className="font-mono text-xs text-muted-foreground">
                    {run.httpStatus ? `HTTP ${run.httpStatus}` : "No HTTP status"}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {formatDuration(run)}
                  </span>
                  {run.rowCount !== null ? (
                    <span className="font-mono text-xs text-muted-foreground">
                      {run.rowCount} rows
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <RunDownloadLinks run={run} />
                  {run.datasetId ? (
                    <a
                      href={`/dashboard/datasets/${run.datasetId}`}
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      <ExternalLinkIcon className="size-3.5" />
                      Imported dataset
                    </a>
                  ) : null}
                </div>
              </div>

              {run.errorMessage ? (
                <Alert variant="destructive">
                  <XCircleIcon className="size-4" />
                  <AlertTitle>Run error</AlertTitle>
                  <AlertDescription>{run.errorMessage}</AlertDescription>
                </Alert>
              ) : null}

              {run.sourceProfileSnapshot &&
              run.mode === "import" &&
              run.status === "success" ? (
                <ImbFormingPanel
                  connectionId={connectionId}
                  sourceRun={run}
                  profileLabel={run.sourceProfileSnapshot.sourceProfileLabel}
                />
              ) : null}

              <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
                <h3 className="text-xs font-semibold uppercase text-muted-foreground">
                  Logs
                </h3>
                {run.logs && run.logs.length > 0 ? (
                  <div className="max-h-48 space-y-1 overflow-auto">
                    {run.logs.map((log) => (
                      <div
                        key={log.id}
                        className={cn(
                          "grid gap-2 font-mono text-xs md:grid-cols-[9rem_minmax(0,1fr)]",
                          log.level === "error"
                            ? "text-destructive"
                            : "text-muted-foreground",
                        )}
                      >
                        <span>{formatUtcTimestamp(log.createdAt)}</span>
                        <span>{log.message}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No logs recorded.</p>
                )}
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase text-muted-foreground">
                  Preview
                </h3>
                <pre className="max-h-96 overflow-auto rounded-lg border border-border bg-muted/40 p-3 text-xs leading-5">
                  {run.responsePreview || "No preview available."}
                </pre>
              </div>
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

export function ApiConnectionDetailClient({
  connection,
  initialRuns,
  serviceAccountEmail,
}: ApiConnectionDetailClientProps) {
  const router = useRouter();
  const googleSheetsConfig = getGoogleSheetsProviderConfig(connection);
  const isGoogleSheetsConnection = googleSheetsConfig !== null;
  const importActionLabel = connection.sourceProfile
    ? "Start ingestion"
    : isGoogleSheetsConnection
    ? connection.targetDatasetId
      ? "Refresh dataset"
      : "Import sheet"
    : "Start ingestion";
  const [runs, setRuns] = useState(() => sortRuns(initialRuns));
  const [selectedRunId, setSelectedRunId] = useState<string | null>(
    initialRuns[0]?.id ?? null,
  );
  const [rowSelection, setRowSelection] = useState<RowSelectionState>(
    initialRuns[0] ? { [initialRuns[0].id]: true } : {},
  );
  const [sorting, setSorting] = useState<SortingState>([
    {
      id: "createdAt",
      desc: true,
    },
  ]);
  const [busyAction, setBusyAction] = useState<"test" | "import" | "refresh" | null>(
    null,
  );
  const [message, setMessage] = useState<DetailMessage | null>(null);
  const [sourceEmailCopied, setSourceEmailCopied] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [sourceBusyAction, setSourceBusyAction] = useState<
    | "check-access"
    | "disconnect"
    | "header-preview"
    | "header-save"
    | "profile-save"
    | "profile-remove"
    | null
  >(null);
  const [sourceProfileKey, setSourceProfileKey] = useState(
    connection.sourceProfile?.configurable ? connection.sourceProfile.key : "",
  );
  const [stableKeyColumn, setStableKeyColumn] = useState(
    connection.sourceProfile?.configurable
      ? (connection.sourceProfile.stableKeyColumn ?? "")
      : "",
  );
  const [isHeaderEditorOpen, setIsHeaderEditorOpen] = useState(false);
  const [headerPreview, setHeaderPreview] =
    useState<GoogleSheetsHeaderPreview | null>(null);
  const [headerSelection, setHeaderSelection] =
    useState<GoogleSheetsHeaderSelectionInput | null>(null);
  const refreshedImportRunIds = useRef(new Set<string>());
  const [isRunDetailSheetOpen, setIsRunDetailSheetOpen] = useState(false);
  const selectedRun = useMemo(
    () => runs.find((run) => run.id === selectedRunId) ?? null,
    [runs, selectedRunId],
  );
  const latestRun = runs[0] ?? null;
  const hasActiveRun = runs.some(isRunActive);

  const selectRun = useCallback((run: ApiConnectionRun) => {
    setSelectedRunId(run.id);
    setRowSelection({ [run.id]: true });
  }, []);

  const openRunDetail = useCallback(
    (run: ApiConnectionRun) => {
      selectRun(run);
      setIsRunDetailSheetOpen(true);
    },
    [selectRun],
  );

  const upsertRun = useCallback(
    (run: ApiConnectionRun) => {
      setRuns((current) => mergeRun(current, run));
      selectRun(run);
    },
    [selectRun],
  );

  const loadRuns = useCallback(async () => {
    const response = await fetch(
      `/api/admin/api-connections/${connection.id}/runs`,
    );

    if (!response.ok) {
      throw new Error(
        await getErrorMessage(response, "API connection runs could not be loaded."),
      );
    }

    const payload = (await response.json()) as ApiConnectionRunsResponse;
    setRuns((current) => mergeRuns(current, payload.runs ?? []));
  }, [connection.id]);

  useEffect(() => {
    if (!selectedRun || !isRunActive(selectedRun)) {
      return;
    }

    let cancelled = false;
    const activeRunId = selectedRun.id;

    async function refreshRun() {
      const response = await fetch(
        `/api/admin/api-connections/${connection.id}/runs/${activeRunId}`,
      );

      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as ApiConnectionRunDetailResponse;

      if (cancelled) {
        return;
      }

      setRuns((current) => mergeRun(current, payload.run));

      if (!isRunActive(payload.run)) {
        void loadRuns().catch(() => undefined);
        setMessage({
          title: getRunLabel(payload.run),
          detail:
            payload.run.status === "success"
              ? formatDuration(payload.run)
              : (payload.run.errorMessage ?? "The run failed."),
          tone: payload.run.status === "failed" ? "error" : "success",
        });
        if (
          payload.run.mode === "import" &&
          payload.run.status === "success" &&
          payload.run.datasetId &&
          !refreshedImportRunIds.current.has(payload.run.id)
        ) {
          refreshedImportRunIds.current.add(payload.run.id);
          router.refresh();
        }
      }
    }

    const interval = window.setInterval(() => {
      void refreshRun();
    }, 1500);
    void refreshRun();

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [connection.id, loadRuns, router, selectedRun]);

  async function handleRun(importEnabled: boolean) {
    setBusyAction(importEnabled ? "import" : "test");
    setMessage(null);

    try {
      const response = await fetch(
        `/api/admin/api-connections/${connection.id}/run`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ importEnabled }),
        },
      );

      if (!response.ok) {
        throw new Error(
          await getErrorMessage(response, "The API connection could not run."),
        );
      }

      const payload = (await response.json()) as ApiConnectionRunResponse;
      upsertRun(payload.run);
      setMessage({
        title: getRunLabel(payload.run),
        detail:
          isRunActive(payload.run)
            ? "The run is processing in the background."
            : payload.run.status === "success"
              ? formatDuration(payload.run)
              : (payload.run.errorMessage ?? "The run failed."),
        tone: payload.run.status === "failed" ? "error" : "success",
      });
    } catch (error) {
      setMessage({
        title: importEnabled ? "Ingestion failed" : "Test failed",
        detail:
          error instanceof Error ? error.message : "The API connection could not run.",
        tone: "error",
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleRefresh() {
    setBusyAction("refresh");
    setMessage(null);

    try {
      await loadRuns();
    } catch (error) {
      setMessage({
        title: "Run history failed",
        detail:
          error instanceof Error
            ? error.message
            : "API connection runs could not be loaded.",
        tone: "error",
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function copySourceServiceAccountEmail() {
    if (!serviceAccountEmail) {
      return;
    }

    await navigator.clipboard?.writeText(serviceAccountEmail);
    setSourceEmailCopied(true);
  }

  async function handleCheckGoogleSheetsAccess() {
    if (!googleSheetsConfig) {
      return;
    }

    setSourceBusyAction("check-access");
    setMessage(null);

    try {
      const response = await fetch(
        `/api/admin/api-connections/google-sheets/${connection.id}`,
      );

      if (!response.ok) {
        throw new Error(
          await getErrorMessage(
            response,
            "Google Sheets source access could not be checked.",
          ),
        );
      }

      const payload =
        (await response.json()) as GoogleSheetsConnectionAccessCheckResponse;
      const selectedSheet = payload.preview.sheets.find(
        (sheet) => sheet.sheetId === googleSheetsConfig.sheetId,
      );

      setMessage({
        title: "Google Sheets access confirmed",
        detail: `${payload.preview.spreadsheetTitle} / ${
          selectedSheet?.title ?? googleSheetsConfig.sheetTitle
        } is readable by the app service account.`,
        tone: "success",
      });
    } catch (error) {
      setMessage({
        title: "Google Sheets access failed",
        detail:
          error instanceof Error
            ? error.message
            : "Google Sheets source access could not be checked.",
        tone: "error",
      });
    } finally {
      setSourceBusyAction(null);
    }
  }

  async function handleDisconnectGoogleSheets() {
    if (!googleSheetsConfig) {
      return;
    }

    setSourceBusyAction("disconnect");
    setMessage(null);

    try {
      const response = await fetch(
        `/api/admin/api-connections/google-sheets/${connection.id}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        throw new Error(
          await getErrorMessage(
            response,
            "Google Sheets connection could not be disconnected.",
          ),
        );
      }

      router.push("/dashboard/api-connections");
    } catch (error) {
      setMessage({
        title: "Disconnect failed",
        detail:
          error instanceof Error
            ? error.message
            : "Google Sheets connection could not be disconnected.",
        tone: "error",
      });
      setSourceBusyAction(null);
    }
  }

  async function saveSourceProfile() {
    if (!sourceProfileKey || !stableKeyColumn.trim()) return;
    setSourceBusyAction("profile-save");
    setMessage(null);
    try {
      const response = await fetch(
        `/api/admin/api-connections/${connection.id}/source-profile`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sourceProfileKey, stableKeyColumn }),
        },
      );
      if (!response.ok) {
        throw new Error(
          await getErrorMessage(response, "The source profile could not be saved."),
        );
      }
      setMessage({
        title: "Source profile configured",
        detail: "Future ingestion runs will stage reviewable formed candidates.",
        tone: "success",
      });
      router.refresh();
    } catch (error) {
      setMessage({
        title: "Source profile failed",
        detail:
          error instanceof Error
            ? error.message
            : "The source profile could not be saved.",
        tone: "error",
      });
    } finally {
      setSourceBusyAction(null);
    }
  }

  async function removeSourceProfile() {
    setSourceBusyAction("profile-remove");
    setMessage(null);
    try {
      const response = await fetch(
        `/api/admin/api-connections/${connection.id}/source-profile`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        throw new Error(
          await getErrorMessage(response, "The source profile could not be removed."),
        );
      }
      setSourceProfileKey("");
      setStableKeyColumn("");
      setMessage({
        title: "Source profile removed",
        detail: "Future imports will publish through the standard connection flow.",
        tone: "success",
      });
      router.refresh();
    } catch (error) {
      setMessage({
        title: "Source profile removal failed",
        detail:
          error instanceof Error
            ? error.message
            : "The source profile could not be removed.",
        tone: "error",
      });
    } finally {
      setSourceBusyAction(null);
    }
  }

  async function loadGoogleSheetsHeaderPreview(
    selection?: GoogleSheetsHeaderSelectionInput,
  ) {
    if (!googleSheetsConfig) {
      return;
    }
    setSourceBusyAction("header-preview");
    setMessage(null);
    try {
      const response = await fetch(
        `/api/admin/api-connections/google-sheets/${connection.id}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ selection }),
        },
      );
      if (!response.ok) {
        throw new Error(
          await getErrorMessage(response, "Google Sheets headers could not be loaded."),
        );
      }
      const payload = (await response.json()) as GoogleSheetsHeaderPreviewResponse;
      const nextSelection = selection ?? {
        sheetId: googleSheetsConfig.sheetId,
        mode: googleSheetsConfig.headerSelection?.mode ?? "auto",
        startRow:
          googleSheetsConfig.headerSelection?.startRow ??
          payload.preview.selected.startRow,
        endRow:
          googleSheetsConfig.headerSelection?.endRow ??
          payload.preview.selected.endRow,
      };
      setHeaderPreview(payload.preview);
      setHeaderSelection(nextSelection);
      setIsHeaderEditorOpen(true);
    } catch (error) {
      setMessage({
        title: "Header preview failed",
        detail:
          error instanceof Error
            ? error.message
            : "Google Sheets headers could not be loaded.",
        tone: "error",
      });
    } finally {
      setSourceBusyAction(null);
    }
  }

  async function saveGoogleSheetsHeaderSelection() {
    if (!headerSelection) {
      return;
    }
    setSourceBusyAction("header-save");
    setMessage(null);
    try {
      const response = await fetch(
        `/api/admin/api-connections/google-sheets/${connection.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ selection: headerSelection }),
        },
      );
      if (!response.ok) {
        throw new Error(
          await getErrorMessage(response, "Google Sheets headers could not be saved."),
        );
      }
      const payload =
        (await response.json()) as GoogleSheetsHeaderSelectionUpdateResponse;
      setHeaderPreview(payload.preview);
      setIsHeaderEditorOpen(false);
      setMessage({
        title: "Header selection saved",
        detail: `Data will begin after row ${payload.preview.selected.endRow}.`,
        tone: "success",
      });
      router.refresh();
    } catch (error) {
      setMessage({
        title: "Header update failed",
        detail:
          error instanceof Error
            ? error.message
            : "Google Sheets headers could not be saved.",
        tone: "error",
      });
    } finally {
      setSourceBusyAction(null);
    }
  }

  const columns = useMemo<ColumnDef<ApiConnectionRun>[]>(
    () => [
      {
        id: "createdAt",
        accessorFn: (run) => new Date(run.createdAt).getTime(),
        header: ({ column }) => (
          <DataGridColumnHeader
            title="Initiated At"
            column={column}
            renderStateKey={`${column.getIsSorted()}:${column.getIsPinned()}`}
          />
        ),
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {formatUtcTimestamp(row.original.createdAt)}
          </span>
        ),
        meta: { headerTitle: "Initiated At" },
        size: 190,
        enableSorting: true,
        enableHiding: false,
      },
      {
        id: "mode",
        accessorFn: (run) => run.mode,
        header: ({ column }) => (
          <DataGridColumnHeader
            title="Mode"
            column={column}
            renderStateKey={`${column.getIsSorted()}:${column.getIsPinned()}`}
          />
        ),
        cell: ({ row }) => getModeLabel(row.original),
        meta: { headerTitle: "Mode" },
        size: 110,
        enableSorting: true,
      },
      {
        id: "status",
        accessorFn: (run) => run.status,
        header: ({ column }) => (
          <DataGridColumnHeader
            title="Status"
            column={column}
            renderStateKey={`${column.getIsSorted()}:${column.getIsPinned()}`}
          />
        ),
        cell: ({ row }) => (
          <Badge
            variant="outline"
            className={cn("capitalize", statusBadgeClass(row.original.status))}
          >
            {row.original.status}
          </Badge>
        ),
        meta: { headerTitle: "Status" },
        size: 120,
        enableSorting: true,
      },
      {
        id: "startedAt",
        accessorFn: (run) =>
          run.startedAt ? new Date(run.startedAt).getTime() : 0,
        header: ({ column }) => (
          <DataGridColumnHeader
            title="Started At"
            column={column}
            renderStateKey={`${column.getIsSorted()}:${column.getIsPinned()}`}
          />
        ),
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {formatUtcTimestamp(row.original.startedAt)}
          </span>
        ),
        meta: { headerTitle: "Started At" },
        size: 190,
        enableSorting: true,
      },
      {
        id: "completedAt",
        accessorFn: (run) =>
          run.completedAt ? new Date(run.completedAt).getTime() : 0,
        header: ({ column }) => (
          <DataGridColumnHeader
            title="Completed At"
            column={column}
            renderStateKey={`${column.getIsSorted()}:${column.getIsPinned()}`}
          />
        ),
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {formatUtcTimestamp(row.original.completedAt)}
          </span>
        ),
        meta: { headerTitle: "Completed At" },
        size: 190,
        enableSorting: true,
      },
      {
        id: "durationMs",
        accessorFn: (run) => run.durationMs,
        header: ({ column }) => (
          <DataGridColumnHeader
            title="Duration"
            column={column}
            renderStateKey={`${column.getIsSorted()}:${column.getIsPinned()}`}
          />
        ),
        cell: ({ row }) => (
          <span className="font-mono text-xs">{formatDuration(row.original)}</span>
        ),
        meta: { headerTitle: "Duration" },
        size: 120,
        enableSorting: true,
      },
      {
        id: "rowCount",
        accessorFn: (run) => run.rowCount ?? -1,
        header: ({ column }) => (
          <DataGridColumnHeader
            title="Rows"
            column={column}
            renderStateKey={`${column.getIsSorted()}:${column.getIsPinned()}`}
          />
        ),
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {row.original.rowCount ?? "Not parsed"}
          </span>
        ),
        meta: { headerTitle: "Rows" },
        size: 110,
        enableSorting: true,
      },
      {
        id: "httpStatus",
        accessorFn: (run) => run.httpStatus ?? -1,
        header: ({ column }) => (
          <DataGridColumnHeader
            title="HTTP"
            column={column}
            renderStateKey={`${column.getIsSorted()}:${column.getIsPinned()}`}
          />
        ),
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {row.original.httpStatus ? `HTTP ${row.original.httpStatus}` : "None"}
          </span>
        ),
        meta: { headerTitle: "HTTP" },
        size: 110,
        enableSorting: true,
      },
      {
        id: "actorEmail",
        accessorFn: (run) => run.actorEmail ?? run.actorOwnerId,
        header: ({ column }) => (
          <DataGridColumnHeader
            title="Actor"
            column={column}
            renderStateKey={`${column.getIsSorted()}:${column.getIsPinned()}`}
          />
        ),
        cell: ({ row }) => (
          <span
            className="font-mono text-xs"
            data-smoke-trigger="api-connection-run-detail-sheet"
          >
            {row.original.actorEmail ?? row.original.actorOwnerId}
          </span>
        ),
        meta: { headerTitle: "Actor" },
        size: 220,
        enableSorting: true,
      },
      {
        id: "artifacts",
        header: ({ column }) => (
          <DataGridColumnHeader
            title="Artifacts"
            column={column}
            renderStateKey={`${column.getIsSorted()}:${column.getIsPinned()}`}
          />
        ),
        cell: ({ row }) => <ArtifactCell run={row.original} />,
        meta: { headerTitle: "Artifacts" },
        size: 210,
        enableSorting: false,
      },
    ],
    [],
  );

  const table = useReactTable({
    data: runs,
    columns,
    getRowId: (row) => row.id,
    state: {
      rowSelection,
      sorting,
    },
    initialState: {
      columnPinning: {
        left: ["createdAt"],
      },
    },
    columnResizeMode: "onChange",
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  const runHistoryScrollAreaClassName =
    runs.length > RUN_HISTORY_VISIBLE_ROW_LIMIT
      ? RUN_HISTORY_SCROLL_AREA_HEIGHT
      : undefined;

  return (
    <div className="space-y-6">
      {message ? (
        <Alert variant={message.tone === "error" ? "destructive" : "default"}>
          {message.tone === "error" ? (
            <XCircleIcon className="size-4" />
          ) : (
            <CheckCircle2Icon className="size-4" />
          )}
          <AlertTitle>{message.title}</AlertTitle>
          <AlertDescription>{message.detail}</AlertDescription>
        </Alert>
      ) : null}

      {googleSheetsConfig ? (
        <Card data-smoke-google-sheets-source>
          <CardHeader className="gap-3">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0">
                <CardTitle className="flex items-center gap-2 text-2xl">
                  <FileSpreadsheetIcon className="size-5 text-muted-foreground" />
                  Google Sheets source
                </CardTitle>
                <CardDescription>
                  Private Google Sheet tab connected through the app service
                  account.
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <a
                  href={googleSheetsConfig.spreadsheetUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  <ExternalLinkIcon className="size-3.5" />
                  Open Google Sheet
                </a>
                {connection.targetDatasetId ? (
                  <a
                    href={`/dashboard/datasets/${connection.targetDatasetId}`}
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    <DatabaseIcon className="size-3.5" />
                    Open dataset
                  </a>
                ) : null}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <div className="text-xs font-semibold uppercase text-muted-foreground">
                  Spreadsheet
                </div>
                <div className="mt-1 truncate font-medium text-foreground">
                  {googleSheetsConfig.spreadsheetTitle}
                </div>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <div className="text-xs font-semibold uppercase text-muted-foreground">
                  Sheet tab
                </div>
                <div className="mt-1 truncate font-medium text-foreground">
                  {googleSheetsConfig.sheetTitle}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/20 p-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold uppercase text-muted-foreground">
                  App service account
                </div>
                <code className="mt-1 block overflow-hidden text-ellipsis font-mono text-xs text-foreground">
                  {serviceAccountEmail ?? "Not configured"}
                </code>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!serviceAccountEmail}
                aria-label="Copy app email"
                onClick={() => void copySourceServiceAccountEmail()}
              >
                {sourceEmailCopied ? (
                  <CheckCircle2Icon className="size-3.5" />
                ) : (
                  <CopyIcon className="size-3.5" />
                )}
                Copy app email
              </Button>
            </div>

            {!serviceAccountEmail ? (
              <Alert variant="destructive">
                <XCircleIcon className="size-4" />
                <AlertTitle>
                  Google Sheets service-account access is not configured
                </AlertTitle>
                <AlertDescription>
                  Configure the server-side Google Sheets service-account email
                  and private key before checking or refreshing this source.
                </AlertDescription>
              </Alert>
            ) : null}

            <div
              className="space-y-3 rounded-lg border border-border bg-muted/20 p-3"
              data-smoke-surface="source-profile-binding"
              data-smoke-ready="source-profile-binding"
            >
              <div>
                <div className="text-xs font-semibold uppercase text-muted-foreground">
                  Forming profile
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Choose the source contract and a column whose value remains
                  stable across refreshes.
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
                <label className="space-y-1 text-xs font-medium">
                  Source contract
                  <select
                    value={sourceProfileKey}
                    onChange={(event) => setSourceProfileKey(event.target.value)}
                    className="block h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Standard dataset import</option>
                    <option value="accelerate-owned-people-groups">
                      Accelerate-owned people groups
                    </option>
                    <option value="wcd-people-groups">
                      World Christian Database
                    </option>
                  </select>
                </label>
                <label className="space-y-1 text-xs font-medium">
                  Stable-key column
                  <input
                    value={stableKeyColumn}
                    onChange={(event) => setStableKeyColumn(event.target.value)}
                    disabled={!sourceProfileKey}
                    placeholder="Record ID"
                    className="block h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  {sourceProfileKey ? (
                    <Button
                      type="button"
                      size="sm"
                      disabled={
                        !stableKeyColumn.trim() || sourceBusyAction !== null
                      }
                      onClick={() => void saveSourceProfile()}
                      data-smoke-trigger="source-profile-binding"
                      data-smoke-write="unsafe"
                    >
                      {sourceBusyAction === "profile-save" ? (
                        <Loader2Icon className="size-3.5 animate-spin" />
                      ) : null}
                      Save profile
                    </Button>
                  ) : null}
                  {connection.sourceProfile?.configurable ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={sourceBusyAction !== null}
                      onClick={() => void removeSourceProfile()}
                    >
                      Remove
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>

            {isHeaderEditorOpen ? (
              <div className="space-y-3">
                <GoogleSheetsHeaderSelection
                  preview={headerPreview}
                  selection={headerSelection}
                  isLoading={sourceBusyAction === "header-preview"}
                  disabled={sourceBusyAction !== null}
                  onChange={(selection) => {
                    setHeaderSelection(selection);
                    void loadGoogleSheetsHeaderPreview(selection);
                  }}
                />
                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={sourceBusyAction !== null}
                    onClick={() => setIsHeaderEditorOpen(false)}
                    data-smoke-close="google-sheets-header-selection"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={!headerSelection || sourceBusyAction !== null}
                    onClick={() => void saveGoogleSheetsHeaderSelection()}
                  >
                    {sourceBusyAction === "header-save" ? (
                      <Loader2Icon className="size-3.5 animate-spin" />
                    ) : null}
                    Save header selection
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!serviceAccountEmail || sourceBusyAction !== null}
                onClick={() => void loadGoogleSheetsHeaderPreview()}
                data-smoke-trigger="google-sheets-header-selection"
              >
                {sourceBusyAction === "header-preview" ? (
                  <Loader2Icon className="size-3.5 animate-spin" />
                ) : (
                  <Settings2Icon className="size-3.5" />
                )}
                Review headers
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={!serviceAccountEmail || sourceBusyAction !== null}
                onClick={handleCheckGoogleSheetsAccess}
              >
                {sourceBusyAction === "check-access" ? (
                  <Loader2Icon className="size-3.5 animate-spin" />
                ) : (
                  <CheckCircle2Icon className="size-3.5" />
                )}
                Check access
              </Button>
              {!confirmDisconnect ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={sourceBusyAction !== null}
                  onClick={() => setConfirmDisconnect(true)}
                >
                  <Trash2Icon className="size-3.5" />
                  Disconnect
                </Button>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={sourceBusyAction !== null}
                    onClick={handleDisconnectGoogleSheets}
                  >
                    {sourceBusyAction === "disconnect" ? (
                      <Loader2Icon className="size-3.5 animate-spin" />
                    ) : (
                      <Trash2Icon className="size-3.5" />
                    )}
                    Confirm disconnect
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={sourceBusyAction !== null}
                    onClick={() => setConfirmDisconnect(false)}
                  >
                    Cancel
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <DatabaseIcon className="size-5 text-muted-foreground" />
                Source status
              </CardTitle>
              <CardDescription>
                Test the source, import the latest rows, or review the last result.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={busyAction !== null || hasActiveRun}
                onClick={() => handleRun(false)}
                data-smoke-api-connection-test
              >
                {busyAction === "test" ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : (
                  <PlayIcon className="size-4" />
                )}
                Run test
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={busyAction !== null || hasActiveRun}
                onClick={() => handleRun(true)}
                data-smoke-api-connection-import
              >
                {busyAction === "import" ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : (
                  <UploadCloudIcon className="size-4" />
                )}
                {importActionLabel}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busyAction !== null}
                onClick={handleRefresh}
              >
                {busyAction === "refresh" ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : (
                  <RefreshCcwIcon className="size-4" />
                )}
                Refresh history
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border bg-muted/20 p-3">
              <div className="text-xs font-semibold uppercase text-muted-foreground">
                Provider
              </div>
              <div className="mt-1 font-medium">
                {isGoogleSheetsConnection ? "Google Sheets" : "Code-managed API"}
              </div>
            </div>
            <div className="rounded-lg border bg-muted/20 p-3">
              <div className="text-xs font-semibold uppercase text-muted-foreground">
                Dataset target
              </div>
              <div className="mt-1 font-medium">
                {connection.targetDatasetId ? "Connected" : "Not imported yet"}
              </div>
            </div>
            <div className="rounded-lg border bg-muted/20 p-3">
              <div className="text-xs font-semibold uppercase text-muted-foreground">
                Latest result
              </div>
              <div className="mt-1 font-medium capitalize">
                {latestRun ? getRunLabel(latestRun) : "No runs yet"}
              </div>
            </div>
          </div>
          {latestRun ? (
            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Badge
                variant="outline"
                className={cn("capitalize", statusBadgeClass(latestRun.status))}
              >
                {getRunLabel(latestRun)}
              </Badge>
              <span className="font-mono text-xs">
                Last initiated {formatUtcTimestamp(latestRun.createdAt)}
              </span>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Run history</CardTitle>
          <CardDescription>
            Initiated test and import runs for {connection.name}. Select a row to
            inspect its details.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataGrid
            table={table}
            recordCount={runs.length}
            emptyMessage="No runs have been initiated yet."
            onRowClick={openRunDetail}
            tableLayout={{
              columnsPinnable: true,
              columnsResizable: true,
              headerSticky: true,
              rowBorder: true,
            }}
            tableClassNames={{
              headerSticky: "sticky top-0 z-10 bg-muted/90 backdrop-blur-xs",
              bodyRow: "h-11 [&>td]:align-top [&>td]:py-2.5",
            }}
          >
            <DataGridContainer>
              <DataGridScrollArea className={runHistoryScrollAreaClassName}>
                <DataGridTable />
              </DataGridScrollArea>
            </DataGridContainer>
          </DataGrid>
        </CardContent>
      </Card>

      <RunDetailSheet
        connectionId={connection.id}
        run={selectedRun}
        open={isRunDetailSheetOpen}
        onOpenChange={setIsRunDetailSheetOpen}
      />
    </div>
  );
}
