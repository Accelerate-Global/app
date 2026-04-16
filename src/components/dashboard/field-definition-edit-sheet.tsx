"use client";

import Link from "next/link";
import { useState } from "react";

import { FieldSourceTagList } from "@/components/dashboard/field-source-tag-list";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { FieldDefinition } from "@/lib/api-types";

type FieldDefinitionEditSheetProps = {
  fieldDefinition: FieldDefinition | null;
  open: boolean;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onSaveFieldDefinition: (input: {
    fieldDefinitionId: string;
    displayLabel: string;
    definition: string;
    hideFromViewerFieldDefinitions: boolean;
  }) => Promise<void>;
};

export function FieldDefinitionEditSheet({
  fieldDefinition,
  open,
  isSaving,
  onOpenChange,
  onSaveFieldDefinition,
}: FieldDefinitionEditSheetProps) {
  if (!fieldDefinition) {
    return null;
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 sm:max-w-lg"
        data-smoke-surface="field-definition-edit-sheet"
        data-smoke-ready="field-definition-edit-sheet"
      >
        <FieldDefinitionEditSheetForm
          key={fieldDefinition.id}
          fieldDefinition={fieldDefinition}
          isSaving={isSaving}
          onOpenChange={onOpenChange}
          onSaveFieldDefinition={onSaveFieldDefinition}
        />
      </SheetContent>
    </Sheet>
  );
}

function FieldDefinitionEditSheetForm({
  fieldDefinition,
  isSaving,
  onOpenChange,
  onSaveFieldDefinition,
}: Omit<FieldDefinitionEditSheetProps, "open"> & {
  fieldDefinition: FieldDefinition;
}) {
  const [displayLabel, setDisplayLabel] = useState(
    () => fieldDefinition.displayLabel,
  );
  const [definition, setDefinition] = useState(() => fieldDefinition.definition);
  const [hideFromViewerFieldDefinitions, setHideFromViewerFieldDefinitions] =
    useState(() => fieldDefinition.hideFromViewerFieldDefinitions);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const trimmedDisplayLabel = displayLabel.trim();
  const trimmedDefinition = definition.trim();
  const hasChanges =
    trimmedDisplayLabel !== fieldDefinition.displayLabel ||
    trimmedDefinition !== fieldDefinition.definition ||
    hideFromViewerFieldDefinitions !==
      fieldDefinition.hideFromViewerFieldDefinitions;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!hasChanges) {
      setErrorMessage(null);
      return;
    }

    setErrorMessage(null);

    try {
      await onSaveFieldDefinition({
        fieldDefinitionId: fieldDefinition.id,
        displayLabel,
        definition,
        hideFromViewerFieldDefinitions,
      });
      onOpenChange(false);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The field definition could not be updated.",
      );
    }
  }

  return (
    <form className="flex h-full flex-col" onSubmit={handleSubmit}>
      <SheetHeader className="border-b border-border px-6 py-5">
        <SheetTitle>Edit field</SheetTitle>
        <SheetDescription>
          Update the field name, tooltip text, and viewer visibility settings.
        </SheetDescription>
      </SheetHeader>

      <div className="flex-1 space-y-6 overflow-y-auto overscroll-contain px-6 py-5">
        <section className="space-y-2">
          <p className="text-sm font-medium text-foreground">
            Original field name
          </p>
          <div className="rounded-2xl border border-border bg-card px-4 py-3">
            <p className="font-medium text-foreground">
              {fieldDefinition.label}
            </p>
          </div>
        </section>

        <section className="space-y-2">
          <label
            className="text-sm font-medium text-foreground"
            htmlFor="field-definition-display-label"
          >
            Display label
          </label>
          <Input
            id="field-definition-display-label"
            value={displayLabel}
            disabled={isSaving}
            placeholder={fieldDefinition.label}
            data-smoke-field-definition-display-label
            onChange={(event) => setDisplayLabel(event.target.value)}
          />
          <p className="text-sm text-muted-foreground">
            Leave blank to use the original field name anywhere this field
            appears.
          </p>
        </section>

        <section className="space-y-2">
          <label
            className="text-sm font-medium text-foreground"
            htmlFor="field-definition-definition"
          >
            Definition
          </label>
          <textarea
            id="field-definition-definition"
            value={definition}
            disabled={isSaving}
            placeholder="No definition available yet."
            data-smoke-field-definition-definition
            className="min-h-32 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 dark:bg-input/30 dark:disabled:bg-input/80"
            onChange={(event) => setDefinition(event.target.value)}
          />
          <p className="text-sm text-muted-foreground">
            This text appears when someone opens the field info tooltip in a
            dataset header.
          </p>
        </section>

        <section className="space-y-3 rounded-2xl border border-border bg-card px-4 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <label
                className="text-sm font-medium text-foreground"
                htmlFor="field-definition-hide-from-viewers"
              >
                Hide from viewer Definitions page
              </label>
              <p className="text-sm text-muted-foreground">
                Non-admin viewers will not see this field on the Definitions
                page. Dataset tables and field tooltips stay unchanged.
              </p>
            </div>
            <Switch
              id="field-definition-hide-from-viewers"
              checked={hideFromViewerFieldDefinitions}
              disabled={isSaving}
              aria-label="Hide from viewer Definitions page"
              onCheckedChange={setHideFromViewerFieldDefinitions}
            />
          </div>
        </section>

        <section className="space-y-3">
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">Sources</p>
            <p className="text-sm text-muted-foreground">
              These database links are managed from{" "}
              <Link
                href="/dashboard/field-sources"
                className="font-medium text-foreground underline underline-offset-4"
              >
                Field Sources
              </Link>
              .
            </p>
          </div>
          {fieldDefinition.linkedSources.length > 0 ? (
            <FieldSourceTagList linkedSources={fieldDefinition.linkedSources} />
          ) : (
            <p className="text-sm text-muted-foreground">
              No linked source databases yet.
            </p>
          )}
        </section>

        {errorMessage ? (
          <Alert variant="destructive">
            <AlertTitle>Field update failed</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}
      </div>

      <SheetFooter className="border-t border-border px-6 py-4 sm:flex-row sm:justify-end">
        <Button
          type="submit"
          disabled={isSaving || !hasChanges}
          data-smoke-field-definition-save
        >
          Save changes
        </Button>
        <SheetClose
          render={
            <Button
              type="button"
              variant="outline"
              disabled={isSaving}
              data-smoke-close="field-definition-edit-sheet"
            />
          }
        >
          Cancel
        </SheetClose>
      </SheetFooter>
    </form>
  );
}
