"use client";

import { PlusIcon, XIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { DatasetTagList } from "@/components/dashboard/dataset-tag-list";
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
import type { DatasetSummary, DatasetTag } from "@/lib/api-types";
import {
  DATASET_TAG_COLOR_OPTIONS,
  DEFAULT_DATASET_TAG_COLOR,
  normalizeDatasetTagColor,
  normalizeDatasetTags,
} from "@/lib/dataset-tags";

type DatasetEditDrawerProps = {
  dataset: DatasetSummary;
  open: boolean;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onSaveDataset: (input: {
    datasetId: string;
    fileName: string;
    tags: DatasetTag[];
  }) => Promise<void>;
};

function formatUploadedAt(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function DatasetTagColorSelector({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const normalizedValue = normalizeDatasetTagColor(value);

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <div className="flex flex-wrap gap-2">
        {DATASET_TAG_COLOR_OPTIONS.map((option) => {
          const isSelected = normalizedValue === option.color;

          return (
            <button
              key={option.color}
              type="button"
              disabled={disabled}
              aria-label={`${option.label} ${option.color}`}
              aria-pressed={isSelected}
              className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-accent/35 disabled:cursor-not-allowed disabled:opacity-60"
              style={{
                borderColor: isSelected ? option.color : undefined,
                backgroundColor: isSelected ? `${option.color}1f` : undefined,
              }}
              onClick={() => onChange(option.color)}
            >
              <span
                className="size-3 rounded-full border border-border"
                style={{ backgroundColor: option.color }}
              />
              <span>{option.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function DatasetEditDrawer({
  dataset,
  open,
  isSaving,
  onOpenChange,
  onSaveDataset,
}: DatasetEditDrawerProps) {
  const [fileName, setFileName] = useState(dataset.fileName);
  const [tags, setTags] = useState(() => normalizeDatasetTags(dataset.tags));
  const [newTagLabel, setNewTagLabel] = useState("");
  const [newTagColor, setNewTagColor] = useState(DEFAULT_DATASET_TAG_COLOR);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const trimmedFileName = fileName.trim();
  const normalizedTags = useMemo(() => normalizeDatasetTags(tags), [tags]);
  const initialTags = useMemo(
    () => normalizeDatasetTags(dataset.tags),
    [dataset.tags],
  );
  const hasTagChanges =
    JSON.stringify(normalizedTags) !== JSON.stringify(initialTags);
  const canSave = Boolean(
    trimmedFileName &&
      !isSaving &&
      (trimmedFileName !== dataset.fileName || hasTagChanges),
  );
  const uploadedAt = useMemo(
    () => formatUploadedAt(dataset.createdAt),
    [dataset.createdAt],
  );

  function createTagId() {
    return globalThis.crypto?.randomUUID?.() ??
      `tag-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function handleAddTag() {
    const label = newTagLabel.trim();

    if (!label) {
      setErrorMessage("Enter a tag label before adding it.");
      return;
    }

    setTags((current) => [
      ...current,
      {
        id: createTagId(),
        label,
        color: normalizeDatasetTagColor(newTagColor),
      },
    ]);
    setNewTagLabel("");
    setNewTagColor(DEFAULT_DATASET_TAG_COLOR);
    setErrorMessage(null);
  }

  function handleTagChange(
    tagId: string,
    nextValue: Partial<Pick<DatasetTag, "label" | "color">>,
  ) {
    setTags((current) =>
      current.map((tag) =>
        tag.id === tagId
          ? {
              ...tag,
              ...nextValue,
            }
          : tag,
      ),
    );
  }

  function handleRemoveTag(tagId: string) {
    setTags((current) => current.filter((tag) => tag.id !== tagId));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!trimmedFileName) {
      setErrorMessage("The dataset name cannot be empty.");
      return;
    }

    if (trimmedFileName === dataset.fileName && !hasTagChanges) {
      setErrorMessage(null);
      return;
    }

    if (tags.some((tag) => tag.label.trim().length === 0)) {
      setErrorMessage("Each tag needs text or should be removed.");
      return;
    }

    setErrorMessage(null);

    try {
      await onSaveDataset({
        datasetId: dataset.id,
        fileName: trimmedFileName,
        tags: normalizedTags,
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

            <section className="space-y-4">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Tags</p>
                <p className="text-sm text-muted-foreground">
                  Add small colored tags shown in the dataset list.
                </p>
              </div>

              <div className="flex items-end gap-3">
                <div className="min-w-0 flex-1 space-y-2">
                  <label
                    className="text-sm font-medium text-foreground"
                    htmlFor="dataset-new-tag"
                  >
                    New tag
                  </label>
                  <Input
                    id="dataset-new-tag"
                    value={newTagLabel}
                    disabled={isSaving}
                    placeholder="Regional focus"
                    onChange={(event) => setNewTagLabel(event.target.value)}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSaving}
                  onClick={handleAddTag}
                >
                  <PlusIcon />
                  Add tag
                </Button>
              </div>

              <DatasetTagColorSelector
                label="Preset colors"
                value={newTagColor}
                disabled={isSaving}
                onChange={setNewTagColor}
              />

              {tags.length > 0 ? (
                <div className="space-y-3">
                  {tags.map((tag) => (
                    <div
                      key={tag.id}
                      className="space-y-3 rounded-2xl border border-border bg-card px-4 py-4"
                    >
                      <div className="flex items-end gap-3">
                        <div className="min-w-0 flex-1 space-y-2">
                          <label
                            className="text-sm font-medium text-foreground"
                            htmlFor={`dataset-tag-${tag.id}`}
                          >
                            Tag text
                          </label>
                          <Input
                            id={`dataset-tag-${tag.id}`}
                            value={tag.label}
                            disabled={isSaving}
                            onChange={(event) =>
                              handleTagChange(tag.id, {
                                label: event.target.value,
                              })
                            }
                          />
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          disabled={isSaving}
                          aria-label={`Remove ${tag.label}`}
                          onClick={() => handleRemoveTag(tag.id)}
                        >
                          <XIcon />
                        </Button>
                      </div>

                      <DatasetTagColorSelector
                        label="Tag color"
                        value={tag.color}
                        disabled={isSaving}
                        onChange={(value) =>
                          handleTagChange(tag.id, {
                            color: value,
                          })
                        }
                      />

                      <div className="rounded-2xl border border-border bg-background px-4 py-4">
                        <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                          Preview
                        </p>
                        <DatasetTagList
                          tags={[
                            {
                              ...tag,
                              color: normalizeDatasetTagColor(tag.color),
                            },
                          ]}
                          className="mt-3"
                        />
                      </div>
                    </div>
                  ))}

                  <div className="rounded-2xl border border-border bg-card px-4 py-4">
                    <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                      All tags
                    </p>
                    <DatasetTagList tags={normalizedTags} className="mt-3" />
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border px-4 py-4 text-sm text-muted-foreground">
                  No tags added yet.
                </div>
              )}
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
