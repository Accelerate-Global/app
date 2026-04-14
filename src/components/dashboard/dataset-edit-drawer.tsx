"use client";

import { useMemo, useState } from "react";

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
import type { DatasetSummary } from "@/lib/api-types";

type DatasetEditDrawerProps = {
  dataset: DatasetSummary;
  open: boolean;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onSaveDatasetName: (input: {
    datasetId: string;
    fileName: string;
  }) => Promise<void>;
};

function formatUploadedAt(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function DatasetEditDrawer({
  dataset,
  open,
  isSaving,
  onOpenChange,
  onSaveDatasetName,
}: DatasetEditDrawerProps) {
  const [fileName, setFileName] = useState(dataset.fileName);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const trimmedFileName = fileName.trim();
  const canSave = Boolean(
    trimmedFileName && trimmedFileName !== dataset.fileName && !isSaving,
  );
  const uploadedAt = useMemo(
    () => formatUploadedAt(dataset.createdAt),
    [dataset.createdAt],
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!trimmedFileName) {
      setErrorMessage("The dataset name cannot be empty.");
      return;
    }

    if (trimmedFileName === dataset.fileName) {
      setErrorMessage(null);
      return;
    }

    setErrorMessage(null);

    try {
      await onSaveDatasetName({
        datasetId: dataset.id,
        fileName: trimmedFileName,
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The dataset name could not be updated.",
      );
    }
  }

  return (
    <Drawer direction="right" open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="w-full sm:max-w-lg">
        <form className="flex h-full flex-col" onSubmit={handleSubmit}>
          <DrawerHeader className="border-b border-border px-6 py-5">
            <DrawerTitle>Edit dataset</DrawerTitle>
            <DrawerDescription>
              Configure the dataset details for everyone who can view it.
            </DrawerDescription>
          </DrawerHeader>

          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
            <section className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                Current dataset
              </p>
              <div className="rounded-2xl border border-border bg-card px-4 py-3">
                <p className="font-medium text-foreground">{dataset.fileName}</p>
              </div>
            </section>

            <section className="space-y-2">
              <label
                className="text-sm font-medium text-foreground"
                htmlFor="dataset-file-name"
              >
                Dataset name
              </label>
              <Input
                id="dataset-file-name"
                value={fileName}
                disabled={isSaving}
                onChange={(event) => setFileName(event.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                Update the name shown in the dataset list.
              </p>
            </section>

            <section className="space-y-2">
              <p className="text-sm font-medium text-foreground">Uploaded</p>
              <div className="rounded-2xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
                {uploadedAt}
              </div>
            </section>

            {errorMessage ? (
              <p className="text-sm text-destructive">{errorMessage}</p>
            ) : null}
          </div>

          <DrawerFooter className="border-t border-border px-6 py-4 sm:flex-row sm:justify-end">
            <DrawerClose asChild>
              <Button type="button" variant="outline">
                Close
              </Button>
            </DrawerClose>
            <Button type="submit" disabled={!canSave}>
              {isSaving ? "Saving..." : "Save changes"}
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
