"use client";

import { CheckIcon, ChevronDownIcon, PlusIcon, XIcon } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

function DatasetTagColorMenu({
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
  const activeOption =
    DATASET_TAG_COLOR_OPTIONS.find((option) => option.color === normalizedValue) ??
    DATASET_TAG_COLOR_OPTIONS[0];

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">{label}</label>
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={disabled}
          render={
            <Button
              type="button"
              variant="outline"
              className="w-full justify-between"
            >
              <span className="flex items-center gap-2">
                <span
                  className="size-3 rounded-full border border-border"
                  style={{ backgroundColor: activeOption.color }}
                />
                <span>{activeOption.label}</span>
              </span>
              <ChevronDownIcon className="size-4 text-muted-foreground" />
            </Button>
          }
        />
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Tag color</DropdownMenuLabel>
            {DATASET_TAG_COLOR_OPTIONS.map((option) => {
              const isSelected = normalizedValue === option.color;

              return (
                <DropdownMenuItem
                  key={option.color}
                  onClick={() => onChange(option.color)}
                  className="justify-between gap-3"
                >
                  <span className="flex items-center gap-2">
                    <span
                      className="size-3 rounded-full border border-border"
                      style={{ backgroundColor: option.color }}
                    />
                    <span>{option.label}</span>
                  </span>
                  {isSelected ? <CheckIcon className="size-4" /> : null}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function DatasetTagEditor({
  tag,
  disabled,
  onChange,
  onRemove,
}: {
  tag: DatasetTag;
  disabled: boolean;
  onChange: (
    tagId: string,
    nextValue: Partial<Pick<DatasetTag, "label" | "color">>,
  ) => void;
  onRemove: (tagId: string) => void;
}) {
  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card px-4 py-4">
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
            disabled={disabled}
            onChange={(event) =>
              onChange(tag.id, {
                label: event.target.value,
              })
            }
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={disabled}
          aria-label={`Remove ${tag.label}`}
          onClick={() => onRemove(tag.id)}
        >
          <XIcon />
        </Button>
      </div>

      <DatasetTagColorMenu
        label="Tag color"
        value={tag.color}
        disabled={disabled}
        onChange={(value) =>
          onChange(tag.id, {
            color: value,
          })
        }
      />
    </div>
  );
}

function NewTagComposer({
  label,
  color,
  disabled,
  onLabelChange,
  onColorChange,
  onAdd,
}: {
  label: string;
  color: string;
  disabled: boolean;
  onLabelChange: (value: string) => void;
  onColorChange: (value: string) => void;
  onAdd: () => void;
}) {
  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card px-4 py-4">
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
            value={label}
            disabled={disabled}
            placeholder="Regional focus"
            onChange={(event) => onLabelChange(event.target.value)}
          />
        </div>
        <Button type="button" variant="outline" disabled={disabled} onClick={onAdd}>
          <PlusIcon />
          Add tag
        </Button>
      </div>

      <DatasetTagColorMenu
        label="Tag color"
        value={color}
        disabled={disabled}
        onChange={onColorChange}
      />
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

              <NewTagComposer
                label={newTagLabel}
                color={newTagColor}
                disabled={isSaving}
                onLabelChange={setNewTagLabel}
                onColorChange={setNewTagColor}
                onAdd={handleAddTag}
              />

              {tags.length > 0 ? (
                <div className="space-y-3">
                  {tags.map((tag) => (
                    <DatasetTagEditor
                      key={tag.id}
                      tag={tag}
                      disabled={isSaving}
                      onChange={handleTagChange}
                      onRemove={handleRemoveTag}
                    />
                  ))}
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
