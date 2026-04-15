"use client";

import { PencilLineIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { FieldSourceTagList } from "@/components/dashboard/field-source-tag-list";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FieldDefinitionEditDrawer } from "@/components/dashboard/field-definition-edit-drawer";
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
}) {
  const response = await fetch(`/api/field-definitions/${input.fieldDefinitionId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      displayLabel: input.displayLabel,
      definition: input.definition,
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
    <div className="overflow-hidden rounded-2xl border border-border bg-background">
      <div className="border-b border-border bg-muted/35 px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
          Field
        </p>
        <p className="mt-1 text-sm font-medium text-foreground">
          {effectiveLabel}
        </p>
      </div>
      <div className="px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Description
            </p>
            <p
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
                className="hover:bg-transparent [&>:not(:last-child)]:border-r [&>:not(:last-child)]:border-border"
              >
                <TableCell className="px-5 py-4 align-top text-sm font-medium whitespace-normal text-foreground">
                  {getFieldDefinitionEffectiveLabel(fieldDefinition)}
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

export function FieldDefinitionsClient({
  initialFieldDefinitions,
  canEdit,
}: FieldDefinitionsClientProps) {
  const [fieldDefinitions, setFieldDefinitions] = useState(() =>
    sortFieldDefinitions(initialFieldDefinitions),
  );
  const [editingFieldDefinitionId, setEditingFieldDefinitionId] = useState<string | null>(
    null,
  );
  const [isSaving, setIsSaving] = useState(false);

  const hasFieldDefinitions = fieldDefinitions.length > 0;
  const sortedFieldDefinitions = useMemo(
    () => sortFieldDefinitions(fieldDefinitions),
    [fieldDefinitions],
  );
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
          <FieldDefinitionsTable
            fieldDefinitions={sortedFieldDefinitions}
            canEdit={canEdit}
            onEdit={(fieldDefinition) =>
              setEditingFieldDefinitionId(fieldDefinition.id)
            }
          />
        ) : (
          <FieldDefinitionEmptyState />
        )}
      </div>

      <FieldDefinitionEditDrawer
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
