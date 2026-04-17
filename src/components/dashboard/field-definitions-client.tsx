"use client";

import { PencilLineIcon, SearchIcon } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";

import { FieldSourceTagList } from "@/components/dashboard/field-source-tag-list";
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
import { FieldDefinitionEditSheet } from "@/components/dashboard/field-definition-edit-sheet";
import type {
  FieldDefinition,
  FieldDefinitionResponse,
} from "@/lib/api-types";
import { getFieldDefinitionEffectiveLabel } from "@/lib/field-definition-presentation";

type FieldDefinitionsClientProps = {
  initialFieldDefinitions: FieldDefinition[];
  canEdit: boolean;
};

async function getErrorMessage(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error || fallback;
  } catch {
    return fallback;
  }
}

async function saveFieldDefinition(input: {
  fieldDefinitionId: string;
  displayLabel: string;
  definition: string;
  hideFromViewerFieldDefinitions: boolean;
}) {
  const response = await fetch(`/api/field-definitions/${input.fieldDefinitionId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      displayLabel: input.displayLabel,
      definition: input.definition,
      hideFromViewerFieldDefinitions: input.hideFromViewerFieldDefinitions,
    }),
  });

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(response, "The field definition could not be updated."),
    );
  }

  return ((await response.json()) as FieldDefinitionResponse).fieldDefinition;
}

function sortFieldDefinitions(fieldDefinitions: FieldDefinition[]) {
  return [...fieldDefinitions].sort((left, right) =>
    getFieldDefinitionEffectiveLabel(left).localeCompare(
      getFieldDefinitionEffectiveLabel(right),
      undefined,
      {
        sensitivity: "base",
      },
    ),
  );
}

function getFieldDefinitionDescription(definition: string) {
  const trimmedDefinition = definition.trim();

  return trimmedDefinition || "No definition available yet.";
}

function getSearchableFieldDefinitionText(fieldDefinition: FieldDefinition) {
  return [
    getFieldDefinitionEffectiveLabel(fieldDefinition),
    fieldDefinition.label,
    fieldDefinition.definition,
    ...fieldDefinition.linkedSources.map((linkedSource) => linkedSource.label),
  ]
    .join(" ")
    .toLowerCase();
}

function FieldDefinitionName({
  fieldDefinition,
  fieldDefinitionId,
  showHiddenMarker,
}: {
  fieldDefinition: FieldDefinition;
  fieldDefinitionId: string;
  showHiddenMarker: boolean;
}) {
  const effectiveLabel = getFieldDefinitionEffectiveLabel(fieldDefinition);

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      data-smoke-field-definition-name={fieldDefinitionId}
    >
      <span>{effectiveLabel}</span>
      {showHiddenMarker && fieldDefinition.hideFromViewerFieldDefinitions ? (
        <Badge variant="outline" className="rounded-full px-2.5 text-[0.7rem]">
          Hidden from viewers
        </Badge>
      ) : null}
    </div>
  );
}

function FieldDefinitionDescriptionCell({
  fieldDefinition,
  canEdit,
  onEdit,
}: {
  fieldDefinition: FieldDefinition;
  canEdit: boolean;
  onEdit: (fieldDefinition: FieldDefinition) => void;
}) {
  const description = getFieldDefinitionDescription(fieldDefinition.definition);
  const effectiveLabel = getFieldDefinitionEffectiveLabel(fieldDefinition);

  return (
    <div className="relative min-h-16 pr-0 sm:pr-14">
      <p
        data-smoke-field-definition-description={fieldDefinition.id}
        className={
          fieldDefinition.definition.trim()
            ? "whitespace-pre-line text-foreground"
            : "whitespace-pre-line text-muted-foreground"
        }
      >
        {description}
      </p>
      {fieldDefinition.linkedSources.length > 0 ? (
        <FieldSourceTagList
          linkedSources={fieldDefinition.linkedSources}
          className="mt-3"
        />
      ) : null}
      {canEdit ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="absolute top-0 right-0 hidden sm:inline-flex"
          aria-label={`Edit ${effectiveLabel}`}
          data-smoke-trigger="field-definition-edit-sheet"
          data-smoke-write="safe"
          data-smoke-field-definition-id={fieldDefinition.id}
          onClick={() => onEdit(fieldDefinition)}
        >
          <PencilLineIcon className="size-4" />
        </Button>
      ) : null}
    </div>
  );
}

function FieldDefinitionMobileCard({
  fieldDefinition,
  canEdit,
  onEdit,
}: {
  fieldDefinition: FieldDefinition;
  canEdit: boolean;
  onEdit: (fieldDefinition: FieldDefinition) => void;
}) {
  const effectiveLabel = getFieldDefinitionEffectiveLabel(fieldDefinition);
  const description = getFieldDefinitionDescription(fieldDefinition.definition);

  return (
    <div
      className="overflow-hidden rounded-2xl border border-border bg-background"
      data-smoke-field-definition-row={fieldDefinition.id}
    >
      <div className="border-b border-border bg-muted/35 px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
          Field
        </p>
        <div className="mt-1 text-sm font-medium text-foreground">
          <FieldDefinitionName
            fieldDefinition={fieldDefinition}
            fieldDefinitionId={fieldDefinition.id}
            showHiddenMarker={canEdit}
          />
        </div>
      </div>
      <div className="px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Description
            </p>
            <p
              data-smoke-field-definition-description={fieldDefinition.id}
              className={
                fieldDefinition.definition.trim()
                  ? "whitespace-pre-line text-sm leading-6 text-foreground"
                  : "whitespace-pre-line text-sm leading-6 text-muted-foreground"
              }
            >
              {description}
            </p>
            {fieldDefinition.linkedSources.length > 0 ? (
              <FieldSourceTagList
                linkedSources={fieldDefinition.linkedSources}
                className="pt-1"
              />
            ) : null}
          </div>
          {canEdit ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="shrink-0"
              aria-label={`Edit ${effectiveLabel}`}
              data-smoke-trigger="field-definition-edit-sheet"
              data-smoke-write="safe"
              data-smoke-field-definition-id={fieldDefinition.id}
              onClick={() => onEdit(fieldDefinition)}
            >
              <PencilLineIcon className="size-4" />
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function FieldDefinitionsTable({
  fieldDefinitions,
  canEdit,
  onEdit,
}: {
  fieldDefinitions: FieldDefinition[];
  canEdit: boolean;
  onEdit: (fieldDefinition: FieldDefinition) => void;
}) {
  return (
    <>
      <div className="hidden sm:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent [&>:not(:last-child)]:border-r [&>:not(:last-child)]:border-border">
              <TableHead className="h-12 w-[28%] px-5 text-sm font-semibold text-foreground">
                Field
              </TableHead>
              <TableHead className="h-12 px-5 text-sm font-semibold text-foreground">
                Description
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fieldDefinitions.map((fieldDefinition) => (
              <TableRow
                key={fieldDefinition.id}
                data-smoke-field-definition-row={fieldDefinition.id}
                className="hover:bg-transparent [&>:not(:last-child)]:border-r [&>:not(:last-child)]:border-border"
              >
                <TableCell className="px-5 py-4 align-top text-sm font-medium whitespace-normal text-foreground">
                  <FieldDefinitionName
                    fieldDefinition={fieldDefinition}
                    fieldDefinitionId={fieldDefinition.id}
                    showHiddenMarker={canEdit}
                  />
                </TableCell>
                <TableCell className="px-5 py-4 align-top text-sm leading-6 whitespace-normal">
                  <FieldDefinitionDescriptionCell
                    fieldDefinition={fieldDefinition}
                    canEdit={canEdit}
                    onEdit={onEdit}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="grid gap-3 sm:hidden">
        {fieldDefinitions.map((fieldDefinition) => (
          <FieldDefinitionMobileCard
            key={fieldDefinition.id}
            fieldDefinition={fieldDefinition}
            canEdit={canEdit}
            onEdit={onEdit}
          />
        ))}
      </div>
    </>
  );
}

function FieldDefinitionEmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-border px-4 py-8 text-sm text-muted-foreground">
      No dataset fields have been imported yet.
    </div>
  );
}

function FieldDefinitionSearchEmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-border px-4 py-8 text-sm text-muted-foreground">
      No definitions match this search.
    </div>
  );
}

export function FieldDefinitionsClient({
  initialFieldDefinitions,
  canEdit,
}: FieldDefinitionsClientProps) {
  const [fieldDefinitions, setFieldDefinitions] = useState(() =>
    sortFieldDefinitions(initialFieldDefinitions),
  );
  const [searchValue, setSearchValue] = useState("");
  const [editingFieldDefinitionId, setEditingFieldDefinitionId] = useState<string | null>(
    null,
  );
  const [isSaving, setIsSaving] = useState(false);
  const deferredSearchValue = useDeferredValue(searchValue);

  const hasFieldDefinitions = fieldDefinitions.length > 0;
  const sortedFieldDefinitions = useMemo(
    () => sortFieldDefinitions(fieldDefinitions),
    [fieldDefinitions],
  );
  const filteredFieldDefinitions = useMemo(() => {
    const normalizedSearchValue = deferredSearchValue.trim().toLowerCase();

    if (!normalizedSearchValue) {
      return sortedFieldDefinitions;
    }

    return sortedFieldDefinitions.filter((fieldDefinition) =>
      getSearchableFieldDefinitionText(fieldDefinition).includes(
        normalizedSearchValue,
      ),
    );
  }, [deferredSearchValue, sortedFieldDefinitions]);
  const editingFieldDefinition = useMemo(
    () =>
      fieldDefinitions.find(
        (fieldDefinition) => fieldDefinition.id === editingFieldDefinitionId,
      ) ?? null,
    [editingFieldDefinitionId, fieldDefinitions],
  );

  async function handleSaveFieldDefinition(input: {
    fieldDefinitionId: string;
    displayLabel: string;
    definition: string;
    hideFromViewerFieldDefinitions: boolean;
  }) {
    setIsSaving(true);

    try {
      const updatedFieldDefinition = await saveFieldDefinition(input);

      setFieldDefinitions((current) =>
        sortFieldDefinitions(
          current.map((fieldDefinition) =>
            fieldDefinition.id === updatedFieldDefinition.id
              ? updatedFieldDefinition
              : fieldDefinition,
          ),
        ),
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <div className="grid gap-6">
        {hasFieldDefinitions ? (
          <>
            <div className="relative max-w-xl">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={searchValue}
                placeholder="Search definitions"
                aria-label="Search definitions"
                className="pl-9"
                data-smoke-field-definitions-search="field-definitions"
                onChange={(event) => setSearchValue(event.target.value)}
              />
            </div>
            {filteredFieldDefinitions.length > 0 ? (
              <FieldDefinitionsTable
                fieldDefinitions={filteredFieldDefinitions}
                canEdit={canEdit}
                onEdit={(fieldDefinition) =>
                  setEditingFieldDefinitionId(fieldDefinition.id)
                }
              />
            ) : (
              <FieldDefinitionSearchEmptyState />
            )}
          </>
        ) : (
          <FieldDefinitionEmptyState />
        )}
      </div>

      <FieldDefinitionEditSheet
        fieldDefinition={editingFieldDefinition}
        open={editingFieldDefinition !== null}
        isSaving={isSaving}
        onOpenChange={(open) => {
          if (!open) {
            setEditingFieldDefinitionId(null);
          }
        }}
        onSaveFieldDefinition={handleSaveFieldDefinition}
      />
    </>
  );
}
