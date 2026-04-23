"use client";

import Link from "next/link";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { DataLakeSource } from "@/lib/api-types";

type DataLakeClientProps = {
  initialSources: DataLakeSource[];
  canEdit: boolean;
};

type DatasetResponse = {
  dataset: {
    id: string;
    fileName: string;
    sourceOrganizationName?: string | null;
  };
};

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});
const countFormatter = new Intl.NumberFormat("en-US");

function formatUploadDate(value: string) {
  return dateTimeFormatter.format(new Date(value));
}

function formatCount(value: number) {
  return countFormatter.format(value);
}

function getStatusLabel(status: DataLakeSource["status"]) {
  if (status === "ready") {
    return "Ready";
  }

  if (status === "failed") {
    return "Failed";
  }

  return "Processing";
}

function getStatusVariant(status: DataLakeSource["status"]) {
  if (status === "ready") {
    return "secondary" as const;
  }

  if (status === "failed") {
    return "destructive" as const;
  }

  return "outline" as const;
}

async function getErrorMessage(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error || fallback;
  } catch {
    return fallback;
  }
}

async function saveSourceOrganizationName(input: {
  datasetId: string;
  sourceOrganizationName: string | null;
}) {
  const response = await fetch(`/api/datasets/${input.datasetId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sourceOrganizationName: input.sourceOrganizationName,
    }),
  });

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        "The organization name could not be updated.",
      ),
    );
  }

  return ((await response.json()) as DatasetResponse).dataset;
}

export function DataLakeClient({
  initialSources,
  canEdit,
}: DataLakeClientProps) {
  const [sources, setSources] = useState(initialSources);
  const [editingDatasetId, setEditingDatasetId] = useState<string | null>(null);
  const [draftOrganizationName, setDraftOrganizationName] = useState("");
  const [savingDatasetId, setSavingDatasetId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function startEditing(source: DataLakeSource) {
    setEditingDatasetId(source.datasetId);
    setDraftOrganizationName(source.sourceOrganizationName ?? "");
    setSavingDatasetId(null);
    setErrorMessage(null);
  }

  function stopEditing() {
    setEditingDatasetId(null);
    setDraftOrganizationName("");
    setSavingDatasetId(null);
    setErrorMessage(null);
  }

  async function handleSave(source: DataLakeSource) {
    const nextSourceOrganizationName = draftOrganizationName.trim()
      ? draftOrganizationName.trim()
      : null;

    if (nextSourceOrganizationName === source.sourceOrganizationName) {
      stopEditing();
      return;
    }

    setSavingDatasetId(source.datasetId);
    setErrorMessage(null);

    try {
      const dataset = await saveSourceOrganizationName({
        datasetId: source.datasetId,
        sourceOrganizationName: nextSourceOrganizationName,
      });
      const persistedSourceOrganizationName =
        dataset.sourceOrganizationName ?? nextSourceOrganizationName;

      setSources((currentSources) =>
        currentSources.map((currentSource) =>
          currentSource.datasetId === source.datasetId
            ? {
                ...currentSource,
                displayName:
                  persistedSourceOrganizationName ??
                  dataset.fileName ??
                  currentSource.datasetFileName,
                sourceOrganizationName: persistedSourceOrganizationName,
                datasetFileName: dataset.fileName ?? currentSource.datasetFileName,
              }
            : currentSource,
        ),
      );
      stopEditing();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The organization name could not be updated.",
      );
      setSavingDatasetId(null);
    }
  }

  if (sources.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-10 text-center">
        <h3 className="text-lg font-semibold tracking-[-0.02em]">
          No source feeds yet
        </h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {canEdit
            ? "Upload a dataset to start tracking which organizations are feeding Data Partners."
            : "No shared source feeds are available in this workspace yet."}
        </p>
        {canEdit ? (
          <div className="mt-4">
            <Link
              href="/dashboard/upload"
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Upload a dataset
            </Link>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-[-0.02em]">
          Incoming source feeds
        </h2>
        <p className="text-sm leading-6 text-muted-foreground">
          Everyone can review source activity here. Only admins can standardize
          organization names.
        </p>
      </div>
      <Table className="min-w-[860px]">
        <TableHeader>
          <TableRow>
            <TableHead>Organization</TableHead>
            <TableHead>Source file</TableHead>
            <TableHead>Last upload</TableHead>
            <TableHead>Rows</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Visibility</TableHead>
            {canEdit ? <TableHead className="text-right">Actions</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sources.map((source) => {
            const isEditing = editingDatasetId === source.datasetId;
            const nextSourceOrganizationName = draftOrganizationName.trim()
              ? draftOrganizationName.trim()
              : null;
            const isUnchanged =
              nextSourceOrganizationName === source.sourceOrganizationName;

            return (
              <TableRow key={source.datasetId}>
                <TableCell className="align-top">
                  {isEditing ? (
                    <div className="space-y-2">
                      <Input
                        aria-label={`Organization name for ${source.datasetFileName}`}
                        value={draftOrganizationName}
                        placeholder={source.displayName}
                        onChange={(event) =>
                          setDraftOrganizationName(event.target.value)
                        }
                      />
                      {!source.sourceOrganizationName ? (
                        <p className="text-xs leading-5 text-muted-foreground">
                          Leave blank to keep using the dataset filename.
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="font-medium text-foreground">
                        {source.displayName}
                      </p>
                      {!source.sourceOrganizationName ? (
                        <Badge variant="outline" className="rounded-full px-2.5">
                          Uses dataset filename
                        </Badge>
                      ) : null}
                    </div>
                  )}
                </TableCell>
                <TableCell className="align-top font-mono text-xs text-muted-foreground">
                  {source.datasetFileName}
                </TableCell>
                <TableCell className="align-top text-muted-foreground">
                  {formatUploadDate(source.lastUploadAt)}
                </TableCell>
                <TableCell className="align-top text-muted-foreground">
                  {formatCount(source.rowCount)}
                </TableCell>
                <TableCell className="align-top">
                  <Badge
                    variant={getStatusVariant(source.status)}
                    className="rounded-full px-2.5"
                  >
                    {getStatusLabel(source.status)}
                  </Badge>
                </TableCell>
                <TableCell className="align-top">
                  <Badge variant="outline" className="rounded-full px-2.5">
                    {source.isPublic ? "Shared" : "Private"}
                  </Badge>
                </TableCell>
                {canEdit ? (
                  <TableCell className="align-top">
                    <div className="flex justify-end gap-2">
                      {isEditing ? (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => void handleSave(source)}
                            disabled={savingDatasetId === source.datasetId || isUnchanged}
                          >
                            {savingDatasetId === source.datasetId
                              ? "Saving..."
                              : "Save"}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={stopEditing}
                            disabled={savingDatasetId === source.datasetId}
                          >
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          aria-label={`Rename organization for ${source.displayName}`}
                          onClick={() => startEditing(source)}
                        >
                          Rename
                        </Button>
                      )}
                    </div>
                    {isEditing && errorMessage ? (
                      <p className="mt-2 text-right text-xs leading-5 text-destructive">
                        {errorMessage}
                      </p>
                    ) : null}
                  </TableCell>
                ) : null}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
