"use client";

import { useCallback, useMemo, useState } from "react";
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  DownloadIcon,
  FileOutputIcon,
  Loader2Icon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
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
import type { CsvColumn } from "@/lib/api-types";
import { createJoshuaProjectColumns } from "@/lib/partner-exports/templates";
import type {
  PartnerExportColumnInput,
  PartnerExportPreview,
  PartnerExportProfile,
  PartnerExportProfileInput,
  PartnerExportProfilesResponse,
  PartnerExportRun,
  PartnerExportTransform,
} from "@/lib/partner-exports/types";
import { cn } from "@/lib/utils";

type DatasetPartnerExportsProps = {
  datasetId: string;
  sourceColumns: CsvColumn[];
};

const inputClassName =
  "h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

const TRANSFORM_LABELS: Record<PartnerExportTransform, string> = {
  copy: "Copy and trim",
  coalesce: "First non-blank source",
  literal: "Fixed value",
  whole_number: "Whole-number string",
  iso_timestamp: "ISO-8601 timestamp",
  non_negative_whole_number: "Non-negative whole number",
};

function createCustomColumn(sourceColumns: CsvColumn[]): PartnerExportColumnInput {
  const source = sourceColumns[0];
  return {
    outputHeader: source?.label ?? "output_column",
    sourceColumnKeys: source ? [source.key] : [],
    sourceLabelSnapshot: source ? [source.label] : [],
    transform: "copy",
    literalValue: null,
    required: false,
    requiredSeverity: "warning",
  };
}

function createDraft(
  sourceColumns: CsvColumn[],
  profile?: PartnerExportProfile,
): PartnerExportProfileInput {
  if (profile) {
    return {
      name: profile.name,
      partnerKey: profile.partnerKey,
      fileNameStem: profile.fileNameStem,
      columns: profile.columns.map((column) => ({
        outputHeader: column.outputHeader,
        sourceColumnKeys: column.sourceColumnKeys,
        sourceLabelSnapshot: column.sourceLabelSnapshot,
        transform: column.transform,
        literalValue: column.literalValue,
        required: column.required,
        requiredSeverity: column.requiredSeverity,
      })),
    };
  }

  return {
    name: "Joshua Project export",
    partnerKey: "joshua-project",
    fileNameStem: "joshua-project-export",
    columns: createJoshuaProjectColumns(sourceColumns),
  };
}

async function getResponseError(response: Response, fallback: string) {
  const payload = (await response.json().catch(() => null)) as {
    error?: unknown;
  } | null;
  return typeof payload?.error === "string" && payload.error.trim()
    ? payload.error
    : fallback;
}

function formatRunDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function DatasetPartnerExports({
  datasetId,
  sourceColumns,
}: DatasetPartnerExportsProps) {
  const [profiles, setProfiles] = useState<PartnerExportProfile[]>([]);
  const [runs, setRuns] = useState<PartnerExportRun[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoadedExports, setHasLoadedExports] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isManagerOpen, setIsManagerOpen] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [draft, setDraft] = useState<PartnerExportProfileInput>(() =>
    createDraft(sourceColumns),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [busyProfileId, setBusyProfileId] = useState<string | null>(null);
  const [previewProfileId, setPreviewProfileId] = useState<string | null>(null);
  const [preview, setPreview] = useState<PartnerExportPreview | null>(null);
  const [warningsAcknowledged, setWarningsAcknowledged] = useState(false);

  const loadExports = useCallback(async () => {
    const response = await fetch(
      `/api/admin/datasets/${datasetId}/partner-exports`,
      { cache: "no-store" },
    );
    if (!response.ok) {
      throw new Error(await getResponseError(response, "Could not load partner exports."));
    }
    const payload = (await response.json()) as PartnerExportProfilesResponse;
    setProfiles(payload.profiles);
    setRuns(payload.runs);
  }, [datasetId]);

  const runsByProfile = useMemo(() => {
    const grouped = new Map<string, PartnerExportRun[]>();
    for (const run of runs) {
      grouped.set(run.profileId, [...(grouped.get(run.profileId) ?? []), run]);
    }
    return grouped;
  }, [runs]);

  function openManager() {
    setIsManagerOpen(true);

    if (hasLoadedExports || isLoading) {
      return;
    }

    setIsLoading(true);
    setError(null);
    void loadExports()
      .then(() => setHasLoadedExports(true))
      .catch((loadError) => {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Could not load partner exports.",
        );
      })
      .finally(() => setIsLoading(false));
  }

  function openNewProfile() {
    setEditingProfileId(null);
    setDraft(createDraft(sourceColumns));
    setError(null);
    setIsManagerOpen(false);
    setIsSheetOpen(true);
  }

  function openEditProfile(profile: PartnerExportProfile) {
    setEditingProfileId(profile.id);
    setDraft(createDraft(sourceColumns, profile));
    setError(null);
    setIsManagerOpen(false);
    setIsSheetOpen(true);
  }

  function closeProfileEditor() {
    setIsSheetOpen(false);
    setIsManagerOpen(true);
  }

  function setTemplate(partnerKey: PartnerExportProfileInput["partnerKey"]) {
    setDraft((current) => ({
      ...current,
      partnerKey,
      name:
        partnerKey === "joshua-project" && current.name === "Partner export"
          ? "Joshua Project export"
          : current.name,
      fileNameStem:
        partnerKey === "joshua-project" && current.fileNameStem === "partner-export"
          ? "joshua-project-export"
          : current.fileNameStem,
      columns:
        partnerKey === "joshua-project"
          ? createJoshuaProjectColumns(sourceColumns)
          : [createCustomColumn(sourceColumns)],
    }));
  }

  function updateColumn(
    index: number,
    update: (column: PartnerExportColumnInput) => PartnerExportColumnInput,
  ) {
    setDraft((current) => ({
      ...current,
      columns: current.columns.map((column, columnIndex) =>
        columnIndex === index ? update(column) : column,
      ),
    }));
  }

  function moveColumn(index: number, direction: -1 | 1) {
    setDraft((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.columns.length) {
        return current;
      }
      const columns = [...current.columns];
      [columns[index], columns[nextIndex]] = [columns[nextIndex], columns[index]];
      return { ...current, columns };
    });
  }

  async function saveProfile() {
    setIsSaving(true);
    setError(null);
    try {
      const endpoint = editingProfileId
        ? `/api/admin/datasets/${datasetId}/partner-exports/${editingProfileId}`
        : `/api/admin/datasets/${datasetId}/partner-exports`;
      const response = await fetch(endpoint, {
        method: editingProfileId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!response.ok) {
        throw new Error(await getResponseError(response, "Could not save profile."));
      }
      await loadExports();
      setIsSheetOpen(false);
      setIsManagerOpen(true);
      setPreview(null);
      setPreviewProfileId(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save profile.");
    } finally {
      setIsSaving(false);
    }
  }

  async function archiveProfile(profileId: string) {
    setBusyProfileId(profileId);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/datasets/${datasetId}/partner-exports/${profileId}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        throw new Error(await getResponseError(response, "Could not archive profile."));
      }
      await loadExports();
      if (previewProfileId === profileId) {
        setPreview(null);
        setPreviewProfileId(null);
      }
    } catch (archiveError) {
      setError(
        archiveError instanceof Error
          ? archiveError.message
          : "Could not archive profile.",
      );
    } finally {
      setBusyProfileId(null);
    }
  }

  async function previewProfile(profileId: string) {
    setBusyProfileId(profileId);
    setError(null);
    setWarningsAcknowledged(false);
    try {
      const response = await fetch(
        `/api/admin/datasets/${datasetId}/partner-exports/${profileId}/preview`,
        { method: "POST" },
      );
      if (!response.ok) {
        throw new Error(await getResponseError(response, "Could not preview export."));
      }
      const payload = (await response.json()) as { preview: PartnerExportPreview };
      setPreview(payload.preview);
      setPreviewProfileId(profileId);
    } catch (previewError) {
      setError(
        previewError instanceof Error
          ? previewError.message
          : "Could not preview export.",
      );
    } finally {
      setBusyProfileId(null);
    }
  }

  const pollRun = useCallback(
    async (runId: string, attempts = 0) => {
      const response = await fetch(
        `/api/admin/datasets/${datasetId}/partner-exports/runs/${runId}`,
        { cache: "no-store" },
      );
      if (!response.ok) {
        return;
      }
      const payload = (await response.json()) as { run: PartnerExportRun };
      setRuns((current) => [
        payload.run,
        ...current.filter((run) => run.id !== payload.run.id),
      ]);
      if (
        (payload.run.status === "queued" || payload.run.status === "running") &&
        attempts < 30
      ) {
        window.setTimeout(() => void pollRun(runId, attempts + 1), 1000);
      }
    },
    [datasetId],
  );

  async function generateExport(profileId: string) {
    setBusyProfileId(profileId);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/datasets/${datasetId}/partner-exports/${profileId}/runs`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ warningsAcknowledged }),
        },
      );
      if (!response.ok) {
        throw new Error(await getResponseError(response, "Could not generate export."));
      }
      const payload = (await response.json()) as { run: PartnerExportRun };
      setRuns((current) => [payload.run, ...current]);
      void pollRun(payload.run.id);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Could not generate export.");
    } finally {
      setBusyProfileId(null);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="w-fit"
        onClick={openManager}
        data-smoke-trigger="partner-exports-sheet"
      >
        <FileOutputIcon className="size-4" />
        Partner exports
      </Button>

      <Sheet open={isManagerOpen} onOpenChange={setIsManagerOpen}>
        <SheetContent
          className="data-[side=right]:w-full! data-[side=right]:sm:max-w-2xl!"
          data-smoke-surface="partner-exports-sheet"
          data-smoke-ready="partner-exports-sheet"
        >
          <SheetHeader className="border-b pr-14">
            <SheetTitle className="flex items-center gap-2">
              <FileOutputIcon className="size-5 text-muted-foreground" />
              Partner exports
            </SheetTitle>
            <SheetDescription>
              Map this source dataset into a reviewed partner contract, then
              generate a private local download.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-6">
            <div className="flex justify-end">
              <Button
                type="button"
                size="sm"
                onClick={openNewProfile}
                data-smoke-trigger="partner-export-profile-sheet"
              >
                <PlusIcon className="size-4" />
                New export profile
              </Button>
            </div>
        {error ? (
          <Alert variant="destructive">
            <AlertTriangleIcon />
            <AlertTitle>Partner export needs attention</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2Icon className="size-4 animate-spin" />
            Loading export profiles…
          </div>
        ) : profiles.length === 0 ? (
          <div className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
            No export profiles yet. Start with the Joshua Project contract or build
            a custom column crosswalk.
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {profiles.map((profile) => {
              const profileRuns = runsByProfile.get(profile.id) ?? [];
              const latestRun = profileRuns[0] ?? null;
              const isBusy = busyProfileId === profile.id;
              const profilePreview =
                previewProfileId === profile.id ? preview : null;
              const canGenerate =
                Boolean(profilePreview) &&
                profilePreview!.validation.errorCount === 0 &&
                (profilePreview!.validation.warningCount === 0 ||
                  warningsAcknowledged);

              return (
                <article key={profile.id} className="space-y-3 rounded-lg border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold">{profile.name}</h3>
                      <p className="text-xs text-muted-foreground">
                        {profile.columns.length} columns · revision {profile.revision}
                      </p>
                    </div>
                    <Badge variant="outline">
                      {profile.partnerKey === "joshua-project"
                        ? "Joshua Project"
                        : "Custom"}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => openEditProfile(profile)}>
                      <PencilIcon className="size-3.5" /> Edit
                    </Button>
                    <Button type="button" size="sm" variant="outline" disabled={isBusy} onClick={() => void previewProfile(profile.id)}>
                      {isBusy ? <Loader2Icon className="size-3.5 animate-spin" /> : null}
                      Preview
                    </Button>
                    <Button type="button" size="sm" disabled={!canGenerate || isBusy} onClick={() => void generateExport(profile.id)}>
                      Generate CSV
                    </Button>
                    <Button type="button" size="sm" variant="ghost" disabled={isBusy} onClick={() => void archiveProfile(profile.id)}>
                      <Trash2Icon className="size-3.5" /> Archive
                    </Button>
                  </div>

                  {profilePreview ? (
                    <div className="space-y-3 rounded-md bg-muted/30 p-3">
                      <div className="flex flex-wrap gap-2 text-xs">
                        <Badge variant={profilePreview.validation.errorCount ? "destructive" : "secondary"}>
                          {profilePreview.validation.errorCount} errors
                        </Badge>
                        <Badge variant="outline">
                          {profilePreview.validation.warningCount} warnings
                        </Badge>
                        <span className="self-center text-muted-foreground">
                          {profilePreview.previewRowCount} of {profilePreview.sourceRowCount} rows shown
                        </span>
                      </div>
                      {profilePreview.validation.warningCount > 0 ? (
                        <label className="flex items-start gap-2 text-xs">
                          <input
                            type="checkbox"
                            checked={warningsAcknowledged}
                            onChange={(event) => setWarningsAcknowledged(event.target.checked)}
                          />
                          I reviewed and acknowledge the current warnings.
                        </label>
                      ) : null}
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {profilePreview.headers.map((header) => (
                              <TableHead key={header}>{header}</TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {profilePreview.rows.slice(0, 5).map((row, index) => (
                            <TableRow key={index}>
                              {profilePreview.headers.map((header) => (
                                <TableCell key={header}>{row[header] || "—"}</TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : null}

                  {latestRun ? (
                    <div className="flex flex-wrap items-center gap-2 border-t pt-3 text-xs text-muted-foreground">
                      {latestRun.status === "success" ? (
                        <CheckCircle2Icon className="size-3.5 text-emerald-600" />
                      ) : latestRun.status === "queued" || latestRun.status === "running" ? (
                        <Loader2Icon className="size-3.5 animate-spin" />
                      ) : (
                        <AlertTriangleIcon className="size-3.5 text-destructive" />
                      )}
                      <span>{latestRun.status}</span>
                      <span>·</span>
                      <span>{formatRunDate(latestRun.createdAt)}</span>
                      {latestRun.status === "success" ? (
                        <>
                          {(["csv", "crosswalk", "validation"] as const).map((format) => (
                            <a
                              key={format}
                              href={`/api/admin/datasets/${datasetId}/partner-exports/runs/${latestRun.id}/download?format=${format}`}
                              className={cn(buttonVariants({ variant: "link", size: "sm" }), "h-auto px-1 text-xs")}
                            >
                              <DownloadIcon className="size-3" /> {format}
                            </a>
                          ))}
                        </>
                      ) : latestRun.errorMessage ? (
                        <span className="text-destructive">{latestRun.errorMessage}</span>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
          </div>
        </SheetContent>
      </Sheet>

      <Sheet
        open={isSheetOpen}
        onOpenChange={(open) => {
          if (open) {
            setIsSheetOpen(true);
          } else {
            closeProfileEditor();
          }
        }}
      >
        <SheetContent
          className="data-[side=right]:w-full! data-[side=right]:sm:w-2/3! data-[side=right]:sm:max-w-none!"
          data-smoke-surface="partner-export-profile-sheet"
          data-smoke-ready="partner-export-profile-sheet"
        >
          <SheetHeader className="border-b pr-14">
            <SheetTitle>
              {editingProfileId ? "Edit export profile" : "New export profile"}
            </SheetTitle>
            <SheetDescription>
              Select source columns, define exact output headers, and review every
              transformation before generating a file.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-5 overflow-y-auto px-4 pb-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="space-y-1.5 text-sm font-medium">
                Profile name
                <input className={inputClassName} value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
              </label>
              <label className="space-y-1.5 text-sm font-medium">
                Template
                <select className={inputClassName} value={draft.partnerKey} disabled={Boolean(editingProfileId)} onChange={(event) => setTemplate(event.target.value as PartnerExportProfileInput["partnerKey"])}>
                  <option value="joshua-project">Joshua Project</option>
                  <option value="custom">Custom</option>
                </select>
              </label>
              <label className="space-y-1.5 text-sm font-medium">
                <span>Download filename label</span>
                <input
                  aria-label="Download filename label"
                  className={inputClassName}
                  value={draft.fileNameStem}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      fileNameStem: event.target.value,
                    }))
                  }
                />
                <span className="block text-xs font-normal leading-5 text-muted-foreground">
                  Dataset name and UTC download timestamp are added automatically.
                </span>
              </label>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold">Column crosswalk</h3>
                  <p className="text-xs text-muted-foreground">
                    Source values are read by stable column key, never spreadsheet letter.
                  </p>
                </div>
                {draft.partnerKey === "custom" ? (
                  <Button type="button" size="sm" variant="outline" onClick={() => setDraft((current) => ({ ...current, columns: [...current.columns, createCustomColumn(sourceColumns)] }))}>
                    <PlusIcon className="size-3.5" /> Add column
                  </Button>
                ) : null}
              </div>

              {draft.columns.map((column, index) => (
                <div key={`${column.outputHeader}-${index}`} className="grid gap-3 rounded-lg border p-3 lg:grid-cols-[minmax(10rem,1fr)_minmax(12rem,1.2fr)_minmax(10rem,1fr)_auto]">
                  <label className="space-y-1 text-xs font-medium">
                    Output header
                    <input className={inputClassName} value={column.outputHeader} disabled={draft.partnerKey === "joshua-project"} onChange={(event) => updateColumn(index, (current) => ({ ...current, outputHeader: event.target.value }))} />
                  </label>
                  <label className="space-y-1 text-xs font-medium">
                    Source column{column.transform === "coalesce" ? "s" : ""}
                    <select
                      aria-label={`Source for ${column.outputHeader}`}
                      className={cn(inputClassName, column.transform === "coalesce" && "h-20")}
                      multiple={column.transform === "coalesce"}
                      value={
                        column.transform === "coalesce"
                          ? column.sourceColumnKeys
                          : (column.sourceColumnKeys[0] ?? "")
                      }
                      disabled={column.transform === "literal"}
                      onChange={(event) => {
                        const keys = Array.from(event.currentTarget.selectedOptions).map((option) => option.value);
                        updateColumn(index, (current) => ({
                          ...current,
                          sourceColumnKeys: keys,
                          sourceLabelSnapshot: keys.map((key) => sourceColumns.find((source) => source.key === key)?.label ?? key),
                        }));
                      }}
                    >
                      {!column.sourceColumnKeys.length ? <option value="">Choose source…</option> : null}
                      {sourceColumns.map((source) => <option key={source.key} value={source.key}>{source.label}</option>)}
                    </select>
                  </label>
                  <label className="space-y-1 text-xs font-medium">
                    Transformation
                    <select className={inputClassName} value={column.transform} onChange={(event) => {
                      const transform = event.target.value as PartnerExportTransform;
                      updateColumn(index, (current) => ({
                        ...current,
                        transform,
                        sourceColumnKeys: transform === "literal" ? [] : current.sourceColumnKeys.slice(0, transform === "coalesce" ? 10 : 1),
                        sourceLabelSnapshot: transform === "literal" ? [] : current.sourceLabelSnapshot.slice(0, transform === "coalesce" ? 10 : 1),
                      }));
                    }}>
                      {Object.entries(TRANSFORM_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                    {column.transform === "literal" ? (
                      <input aria-label={`Fixed value for ${column.outputHeader}`} className={inputClassName} value={column.literalValue ?? ""} onChange={(event) => updateColumn(index, (current) => ({ ...current, literalValue: event.target.value }))} placeholder="Fixed value" />
                    ) : null}
                  </label>
                  <div className="flex items-end gap-1">
                    <Button type="button" size="icon-sm" variant="ghost" aria-label={`Move ${column.outputHeader} up`} disabled={index === 0 || draft.partnerKey === "joshua-project"} onClick={() => moveColumn(index, -1)}>↑</Button>
                    <Button type="button" size="icon-sm" variant="ghost" aria-label={`Move ${column.outputHeader} down`} disabled={index === draft.columns.length - 1 || draft.partnerKey === "joshua-project"} onClick={() => moveColumn(index, 1)}>↓</Button>
                    {draft.partnerKey === "custom" ? (
                      <Button type="button" size="icon-sm" variant="ghost" aria-label={`Remove ${column.outputHeader}`} disabled={draft.columns.length === 1} onClick={() => setDraft((current) => ({ ...current, columns: current.columns.filter((_, columnIndex) => columnIndex !== index) }))}><Trash2Icon className="size-3.5" /></Button>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-xs lg:col-span-4">
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={column.required} onChange={(event) => updateColumn(index, (current) => ({ ...current, required: event.target.checked }))} />
                      Require mapped value
                    </label>
                    <label className="flex items-center gap-2">
                      Severity
                      <select className="rounded border bg-background px-2 py-1" value={column.requiredSeverity} onChange={(event) => updateColumn(index, (current) => ({ ...current, requiredSeverity: event.target.value as "error" | "warning" }))}>
                        <option value="error">Error</option>
                        <option value="warning">Warning</option>
                      </select>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <SheetFooter className="border-t sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={closeProfileEditor}>Cancel</Button>
            <Button type="button" disabled={isSaving} onClick={() => void saveProfile()}>
              {isSaving ? <Loader2Icon className="size-4 animate-spin" /> : null}
              Save profile
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
