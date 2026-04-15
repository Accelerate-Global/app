"use client";

import { BookTextIcon, Loader2Icon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  FieldDefinition,
  FieldDefinitionResponse,
} from "@/lib/api-types";

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

async function saveFieldDefinition(fieldDefinitionId: string, definition: string) {
  const response = await fetch(`/api/field-definitions/${fieldDefinitionId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ definition }),
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
    left.label.localeCompare(right.label, undefined, {
      sensitivity: "base",
    }),
  );
}

function FieldDefinitionEditorCard({
  fieldDefinition,
  canEdit,
  onSave,
}: {
  fieldDefinition: FieldDefinition;
  canEdit: boolean;
  onSave: (fieldDefinitionId: string, definition: string) => Promise<void>;
}) {
  const [definition, setDefinition] = useState(fieldDefinition.definition);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const hasChanges = definition.trim() !== fieldDefinition.definition;
  const linkedDatasetCount = fieldDefinition.linkedDatasets.length;

  useEffect(() => {
    setDefinition(fieldDefinition.definition);
  }, [fieldDefinition.definition]);

  async function handleSave() {
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSaving(true);

    try {
      await onSave(fieldDefinition.id, definition);
      setSuccessMessage(`Saved ${fieldDefinition.label}.`);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The field definition could not be updated.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="space-y-2">
        <CardTitle className="text-xl">{fieldDefinition.label}</CardTitle>
        <CardDescription>
          {linkedDatasetCount === 0
            ? "Not currently used by any uploaded dataset."
            : `Used by ${linkedDatasetCount} dataset${linkedDatasetCount === 1 ? "" : "s"}.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {fieldDefinition.linkedDatasets.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {fieldDefinition.linkedDatasets.map((dataset) => (
              <Badge key={dataset.id} variant="outline">
                {dataset.fileName}
              </Badge>
            ))}
          </div>
        ) : null}

        {errorMessage ? (
          <Alert variant="destructive">
            <AlertTitle>Field definition update failed</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}

        {successMessage ? (
          <Alert>
            <AlertTitle>Field definition saved</AlertTitle>
            <AlertDescription>{successMessage}</AlertDescription>
          </Alert>
        ) : null}

        {canEdit ? (
          <div className="space-y-2">
            <label
              className="text-sm font-medium text-foreground"
              htmlFor={`field-definition-${fieldDefinition.id}`}
            >
              Definition
            </label>
            <textarea
              id={`field-definition-${fieldDefinition.id}`}
              value={definition}
              disabled={isSaving}
              placeholder="No definition available yet."
              className="min-h-28 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 dark:bg-input/30 dark:disabled:bg-input/80"
              onChange={(event) => setDefinition(event.target.value)}
            />
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                This definition appears in the dataset header tooltip for every matching field.
              </p>
              <Button
                type="button"
                disabled={isSaving || !hasChanges}
                onClick={handleSave}
              >
                {isSaving ? <Loader2Icon className="animate-spin" /> : null}
                Save definition
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-background px-4 py-3 text-sm leading-6 text-foreground">
            {fieldDefinition.definition.trim() || "No definition available yet."}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function FieldDefinitionsClient({
  initialFieldDefinitions,
  canEdit,
}: FieldDefinitionsClientProps) {
  const [fieldDefinitions, setFieldDefinitions] = useState(() =>
    sortFieldDefinitions(initialFieldDefinitions),
  );

  const hasFieldDefinitions = fieldDefinitions.length > 0;
  const sortedFieldDefinitions = useMemo(
    () => sortFieldDefinitions(fieldDefinitions),
    [fieldDefinitions],
  );

  async function handleSaveFieldDefinition(fieldDefinitionId: string, definition: string) {
    const updatedFieldDefinition = await saveFieldDefinition(
      fieldDefinitionId,
      definition,
    );

    setFieldDefinitions((current) =>
      sortFieldDefinitions(
        current.map((fieldDefinition) =>
          fieldDefinition.id === updatedFieldDefinition.id
            ? updatedFieldDefinition
            : fieldDefinition,
        ),
      ),
    );
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader className="space-y-2">
          <CardTitle className="flex items-center gap-2 text-2xl">
            <BookTextIcon className="size-5 text-muted-foreground" />
            Field Definitions
          </CardTitle>
          <CardDescription>
            Review the shared tooltip copy used by dataset column headers across every uploaded dataset.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hasFieldDefinitions ? (
            <div className="grid gap-4">
              {sortedFieldDefinitions.map((fieldDefinition) => (
                <FieldDefinitionEditorCard
                  key={fieldDefinition.id}
                  fieldDefinition={fieldDefinition}
                  canEdit={canEdit}
                  onSave={handleSaveFieldDefinition}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border px-4 py-8 text-sm text-muted-foreground">
              No dataset fields have been imported yet.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
