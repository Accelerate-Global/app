"use client";

import {
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { Loader2Icon, PlusIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { DataGrid, DataGridContainer } from "@/components/reui/data-grid/data-grid";
import { DataGridColumnHeader } from "@/components/reui/data-grid/data-grid-column-header";
import { DataGridScrollArea } from "@/components/reui/data-grid/data-grid-scroll-area";
import { DataGridTable } from "@/components/reui/data-grid/data-grid-table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  FieldSourceGridRow,
  FieldSourceResponse,
  FieldSourceType,
  FieldSourceTypeResponse,
} from "@/lib/api-types";
import {
  buildAnalyticsContext,
  type AnalyticsWorkspaceRole,
  withAnalyticsContext,
} from "@/lib/analytics";
import { trackAppEvent } from "@/lib/analytics-client";

type FieldSourcesClientProps = {
  initialFieldSourceTypes: FieldSourceType[];
  initialFieldSources: FieldSourceGridRow[];
  actorOwnerId?: string;
  workspaceRole?: AnalyticsWorkspaceRole;
};

async function getErrorMessage(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error || fallback;
  } catch {
    return fallback;
  }
}

async function saveFieldSourceValue(input: {
  fieldDefinitionId: string;
  sourceTypeId: string;
  sourceFieldName: string;
}) {
  const response = await fetch(`/api/field-sources/${input.fieldDefinitionId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sourceTypeId: input.sourceTypeId,
      sourceFieldName: input.sourceFieldName,
    }),
  });

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(response, "The field source could not be updated."),
    );
  }

  return ((await response.json()) as FieldSourceResponse).fieldSource;
}

async function createSourceType(label: string) {
  const response = await fetch("/api/field-source-types", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ label }),
  });

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(response, "The source column could not be created."),
    );
  }

  return ((await response.json()) as FieldSourceTypeResponse).fieldSourceType;
}

function sortFieldSources(fieldSources: FieldSourceGridRow[]) {
  return [...fieldSources].sort((left, right) =>
    left.effectiveLabel.localeCompare(right.effectiveLabel, undefined, {
      sensitivity: "base",
    }),
  );
}

function getSourceColumnWidth(label: string) {
  return Math.min(Math.max(label.length * 12, 160), 280);
}

function FieldSourceValueCell({
  fieldDefinitionId,
  sourceTypeId,
  value,
  onCommit,
}: {
  fieldDefinitionId: string;
  sourceTypeId: string;
  value: string;
  onCommit: (input: {
    fieldDefinitionId: string;
    sourceTypeId: string;
    sourceFieldName: string;
  }) => Promise<FieldSourceGridRow>;
}) {
  const [draftValue, setDraftValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setDraftValue(value);
  }, [value]);

  async function commit() {
    const nextValue = draftValue.trim();

    if (nextValue === value.trim()) {
      setDraftValue(value);
      return;
    }

    setIsSaving(true);

    try {
      const updatedFieldSource = await onCommit({
        fieldDefinitionId,
        sourceTypeId,
        sourceFieldName: draftValue,
      });
      setDraftValue(updatedFieldSource.sourceValues[sourceTypeId] ?? "");
    } catch {
      setDraftValue(value);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="relative min-w-[10rem]">
      <Input
        value={draftValue}
        disabled={isSaving}
        placeholder="Not tracked"
        className="pr-8"
        data-smoke-field-source-input={`${fieldDefinitionId}:${sourceTypeId}`}
        onChange={(event) => setDraftValue(event.target.value)}
        onBlur={() => {
          void commit();
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            void commit();
            event.currentTarget.blur();
          }

          if (event.key === "Escape") {
            event.preventDefault();
            setDraftValue(value);
            event.currentTarget.blur();
          }
        }}
      />
      {isSaving ? (
        <Loader2Icon className="pointer-events-none absolute top-1/2 right-2 size-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
      ) : null}
    </div>
  );
}

function FieldSourcesEmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-border px-4 py-8 text-sm text-muted-foreground">
      No field definitions are available yet.
    </div>
  );
}

export function FieldSourcesClient({
  initialFieldSourceTypes,
  initialFieldSources,
  actorOwnerId = "anonymous",
  workspaceRole = "admin",
}: FieldSourcesClientProps) {
  const [fieldSourceTypes, setFieldSourceTypes] = useState(initialFieldSourceTypes);
  const [fieldSources, setFieldSources] = useState(() =>
    sortFieldSources(initialFieldSources),
  );
  const [sorting, setSorting] = useState<SortingState>([
    {
      id: "effectiveLabel",
      desc: false,
    },
  ]);
  const [newSourceLabel, setNewSourceLabel] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCreatingSourceType, setIsCreatingSourceType] = useState(false);
  const analyticsContext = buildAnalyticsContext({
    route: "field_sources",
    actorOwnerId,
    workspaceRole,
  });

  const handleCommitSourceValue = useCallback(async (input: {
    fieldDefinitionId: string;
    sourceTypeId: string;
    sourceFieldName: string;
  }) => {
    setErrorMessage(null);

    try {
      const updatedFieldSource = await saveFieldSourceValue(input);

      setFieldSources((current) =>
        sortFieldSources(
          current.map((fieldSource) =>
            fieldSource.fieldDefinitionId === updatedFieldSource.fieldDefinitionId
              ? updatedFieldSource
              : fieldSource,
          ),
        ),
      );
      trackAppEvent(
        "field_source_value_saved",
        withAnalyticsContext(analyticsContext, {
          source_surface: "field_sources_grid",
          success: true,
          field_definition_id: input.fieldDefinitionId,
          source_type_id: input.sourceTypeId,
          has_value: Boolean(input.sourceFieldName.trim()),
        }),
      );

      return updatedFieldSource;
    } catch (error) {
      trackAppEvent(
        "field_source_value_saved",
        withAnalyticsContext(analyticsContext, {
          source_surface: "field_sources_grid",
          success: false,
          error_code: "field_source_value_save_failed",
          field_definition_id: input.fieldDefinitionId,
          source_type_id: input.sourceTypeId,
          has_value: Boolean(input.sourceFieldName.trim()),
        }),
      );
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The field source could not be updated.",
      );
      throw error;
    }
  }, [analyticsContext]);

  async function handleCreateSourceType() {
    const trimmedLabel = newSourceLabel.trim();

    if (!trimmedLabel) {
      return;
    }

    setErrorMessage(null);
    setIsCreatingSourceType(true);
    const startedAt = Date.now();

    try {
      const fieldSourceType = await createSourceType(trimmedLabel);

      setFieldSourceTypes((current) => [...current, fieldSourceType]);
      setFieldSources((current) =>
        current.map((fieldSource) => ({
          ...fieldSource,
          sourceValues: {
            ...fieldSource.sourceValues,
            [fieldSourceType.id]: "",
          },
        })),
      );
      setNewSourceLabel("");
      trackAppEvent(
        "field_source_type_created",
        withAnalyticsContext(analyticsContext, {
          source_surface: "field_source_create_form",
          success: true,
          duration_ms: Date.now() - startedAt,
          source_type_id: fieldSourceType.id,
          label_length: trimmedLabel.length,
        }),
      );
    } catch (error) {
      trackAppEvent(
        "field_source_type_created",
        withAnalyticsContext(analyticsContext, {
          source_surface: "field_source_create_form",
          success: false,
          error_code: "field_source_type_create_failed",
          duration_ms: Date.now() - startedAt,
          label_length: trimmedLabel.length,
        }),
      );
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The source column could not be created.",
      );
    } finally {
      setIsCreatingSourceType(false);
    }
  }

  const columns = useMemo<ColumnDef<FieldSourceGridRow>[]>(
    () => [
      {
        id: "effectiveLabel",
        accessorFn: (row) => row.effectiveLabel,
        header: ({ column }) => (
          <DataGridColumnHeader title="Field" column={column} />
        ),
        cell: ({ row }) => (
          <p className="min-w-[14rem] font-medium text-foreground">
            {row.original.effectiveLabel}
          </p>
        ),
        meta: { headerTitle: "Field" },
        size: 220,
        enableSorting: true,
        enableHiding: false,
      },
      ...fieldSourceTypes.map(
        (fieldSourceType): ColumnDef<FieldSourceGridRow> => ({
          id: `source:${fieldSourceType.id}`,
          accessorFn: (row) => row.sourceValues[fieldSourceType.id] ?? "",
          header: ({ column }) => (
            <div data-smoke-field-source-column={fieldSourceType.label}>
              <DataGridColumnHeader title={fieldSourceType.label} column={column} />
            </div>
          ),
          cell: ({ row }) => (
            <FieldSourceValueCell
              fieldDefinitionId={row.original.fieldDefinitionId}
              sourceTypeId={fieldSourceType.id}
              value={row.original.sourceValues[fieldSourceType.id] ?? ""}
              onCommit={handleCommitSourceValue}
            />
          ),
          meta: { headerTitle: fieldSourceType.label },
          size: getSourceColumnWidth(fieldSourceType.label),
          enableSorting: false,
        }),
      ),
    ],
    [fieldSourceTypes, handleCommitSourceValue],
  );

  const table = useReactTable({
    data: fieldSources,
    columns,
    getRowId: (row) => row.fieldDefinitionId,
    state: {
      sorting,
    },
    initialState: {
      columnPinning: {
        left: ["effectiveLabel"],
      },
    },
    columnResizeMode: "onChange",
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const hasFieldSources = fieldSources.length > 0;

  return (
    <div className="grid gap-6">
      <section className="flex flex-col gap-4 rounded-2xl border border-border/80 bg-card px-4 py-4 sm:px-5">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-foreground">Add source column</h2>
          <p className="text-sm text-muted-foreground">
            New sources are added as editable columns and immediately become available
            for source tags throughout the workspace.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            value={newSourceLabel}
            disabled={isCreatingSourceType}
            placeholder="Source name"
            className="sm:max-w-sm"
            data-smoke-field-source-add-input
            onChange={(event) => setNewSourceLabel(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void handleCreateSourceType();
              }
            }}
          />
          <Button
            type="button"
            disabled={isCreatingSourceType || !newSourceLabel.trim()}
            data-smoke-field-source-add-submit
            onClick={() => {
              void handleCreateSourceType();
            }}
          >
            {isCreatingSourceType ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : (
              <PlusIcon className="size-4" />
            )}
            Add source
          </Button>
        </div>
      </section>

      {errorMessage ? (
        <Alert variant="destructive">
          <AlertTitle>Field Sources update failed</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      {hasFieldSources ? (
        <DataGrid
          table={table}
          recordCount={fieldSources.length}
          tableLayout={{
            columnsPinnable: true,
            columnsResizable: true,
            headerSticky: true,
          }}
          tableClassNames={{
            headerSticky: "sticky top-0 z-10 bg-muted/90 backdrop-blur-xs",
            bodyRow: "[&>td]:align-top [&>td]:py-2.5",
          }}
        >
          <DataGridContainer>
            <DataGridScrollArea className="h-[560px]">
              <DataGridTable />
            </DataGridScrollArea>
          </DataGridContainer>
        </DataGrid>
      ) : (
        <FieldSourcesEmptyState />
      )}
    </div>
  );
}
