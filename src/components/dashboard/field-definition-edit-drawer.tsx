"use client";

import { useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import type { FieldDefinition } from "@/lib/api-types";

type FieldDefinitionEditDrawerProps = {
  fieldDefinition: FieldDefinition | null;
  open: boolean;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onSaveFieldDefinition: (input: {
    fieldDefinitionId: string;
    displayLabel: string;
    definition: string;
  }) => Promise<void>;
};

export function FieldDefinitionEditDrawer({
  fieldDefinition,
  open,
  isSaving,
  onOpenChange,
  onSaveFieldDefinition,
}: FieldDefinitionEditDrawerProps) {
  if (!fieldDefinition) {
    return null;
  }

  return (
    <Drawer direction="right" open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="w-full sm:max-w-lg">
        <FieldDefinitionEditDrawerForm
          key={fieldDefinition.id}
          fieldDefinition={fieldDefinition}
          isSaving={isSaving}
          onOpenChange={onOpenChange}
          onSaveFieldDefinition={onSaveFieldDefinition}
        />
      </DrawerContent>
    </Drawer>
  );
}

function FieldDefinitionEditDrawerForm({
  fieldDefinition,
  isSaving,
  onOpenChange,
  onSaveFieldDefinition,
}: Omit<FieldDefinitionEditDrawerProps, "open"> & {
  fieldDefinition: FieldDefinition;
}) {
  const [displayLabel, setDisplayLabel] = useState(
    () => fieldDefinition.displayLabel,
  );
  const [definition, setDefinition] = useState(() => fieldDefinition.definition);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const trimmedDisplayLabel = displayLabel.trim();
  const trimmedDefinition = definition.trim();
  const hasChanges =
    trimmedDisplayLabel !== fieldDefinition.displayLabel ||
    trimmedDefinition !== fieldDefinition.definition;

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
      <DrawerHeader className="border-b border-border px-6 py-5">
        <DrawerTitle>Edit field</DrawerTitle>
        <DrawerDescription>
          Update the field name and tooltip text shown to viewers.
        </DrawerDescription>
      </DrawerHeader>

      <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
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
            className="min-h-32 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 dark:bg-input/30 dark:disabled:bg-input/80"
            onChange={(event) => setDefinition(event.target.value)}
          />
          <p className="text-sm text-muted-foreground">
            This text appears when someone opens the field info tooltip in a
            dataset header.
          </p>
        </section>

        {errorMessage ? (
          <Alert variant="destructive">
            <AlertTitle>Field update failed</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}
      </div>

      <DrawerFooter className="border-t border-border px-6 py-4 sm:flex-row sm:justify-end">
        <Button type="submit" disabled={isSaving || !hasChanges}>
          Save changes
        </Button>
        <DrawerClose asChild>
          <Button type="button" variant="outline" disabled={isSaving}>
            Cancel
          </Button>
        </DrawerClose>
      </DrawerFooter>
    </form>
  );
}
