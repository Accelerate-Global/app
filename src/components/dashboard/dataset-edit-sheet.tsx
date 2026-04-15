"use client";

import { PlusIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectTrigger,
} from "@/components/ui/select";
import type { DatasetSummary, DatasetTag } from "@/lib/api-types";
import { normalizeDatasetHiddenColumnKeys } from "@/lib/dataset-column-visibility";
import {
  DATASET_TAG_COLOR_OPTIONS,
  DEFAULT_DATASET_TAG_COLOR,
  getDatasetTagIdentity,
  getDatasetTagStyle,
  normalizeDatasetTagColor,
  normalizeDatasetTags,
} from "@/lib/dataset-tags";

type DatasetEditSheetProps = {
  dataset: DatasetSummary;
  availableTags: DatasetTag[];
  open: boolean;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onSaveDataset: (input: {
    datasetId: string;
    fileName: string;
    tags: DatasetTag[];
    isPrimary: boolean;
    hiddenColumnKeys: string[];
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
      <Select
        value={activeOption.color}
        onValueChange={(nextValue) => {
          if (nextValue) {
            onChange(nextValue);
          }
        }}
        disabled={disabled}
      >
        <SelectTrigger className="w-full justify-between">
          <span className="flex items-center gap-2">
            <span
              className="size-3 rounded-full border border-border"
              style={{ backgroundColor: activeOption.color }}
            />
            <span>{activeOption.label}</span>
          </span>
        </SelectTrigger>
        <SelectContent align="start" className="w-56">
          <SelectLabel>Tag color</SelectLabel>
          {DATASET_TAG_COLOR_OPTIONS.map((option) => (
            <SelectItem key={option.color} value={option.color}>
              <span
                className="size-3 rounded-full border border-border"
                style={{ backgroundColor: option.color }}
              />
              <span>{option.label}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
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

export function DatasetEditSheet({
  dataset,
  availableTags,
  open,
  isSaving,
  onOpenChange,
  onSaveDataset,
}: DatasetEditSheetProps) {
  const router = useRouter();
  const [fileName, setFileName] = useState(dataset.fileName);
  const [isPrimary, setIsPrimary] = useState(dataset.isPrimary);
  const [tags, setTags] = useState(() => normalizeDatasetTags(dataset.tags));
  const [hiddenColumnKeys, setHiddenColumnKeys] = useState(() =>
    normalizeDatasetHiddenColumnKeys(dataset.hiddenColumnKeys, dataset.columns),
  );
  const [newTagLabel, setNewTagLabel] = useState("");
  const [newTagColor, setNewTagColor] = useState(DEFAULT_DATASET_TAG_COLOR);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const nextTagIdRef = useRef(0);

  const trimmedFileName = fileName.trim();
  const normalizedTags = useMemo(() => normalizeDatasetTags(tags), [tags]);
  const normalizedHiddenColumnKeys = useMemo(
    () => normalizeDatasetHiddenColumnKeys(hiddenColumnKeys, dataset.columns),
    [dataset.columns, hiddenColumnKeys],
  );
  const initialTags = useMemo(
    () => normalizeDatasetTags(dataset.tags),
    [dataset.tags],
  );
  const initialHiddenColumnKeys = useMemo(
    () => normalizeDatasetHiddenColumnKeys(dataset.hiddenColumnKeys, dataset.columns),
    [dataset.columns, dataset.hiddenColumnKeys],
  );
  const hasTagChanges =
    JSON.stringify(normalizedTags) !== JSON.stringify(initialTags);
  const hasHiddenColumnChanges =
    JSON.stringify(normalizedHiddenColumnKeys) !==
    JSON.stringify(initialHiddenColumnKeys);
  const hasPrimaryChange = isPrimary !== dataset.isPrimary;
  const canSave = Boolean(
    trimmedFileName &&
      !isSaving &&
      (trimmedFileName !== dataset.fileName ||
        hasTagChanges ||
        hasHiddenColumnChanges ||
        hasPrimaryChange),
  );
  const uploadedAt = useMemo(
    () => formatUploadedAt(dataset.createdAt),
    [dataset.createdAt],
  );
  const currentTagIdentities = useMemo(
    () => new Set(normalizedTags.map((tag) => getDatasetTagIdentity(tag))),
    [normalizedTags],
  );
  const reusableTags = useMemo(
    () =>
      availableTags.filter(
        (tag) => !currentTagIdentities.has(getDatasetTagIdentity(tag)),
      ),
    [availableTags, currentTagIdentities],
  );

  function createTagId() {
    if (globalThis.crypto?.randomUUID) {
      return globalThis.crypto.randomUUID();
    }

    const nextId = nextTagIdRef.current;
    nextTagIdRef.current += 1;
    return `tag-${dataset.id}-${nextId}`;
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

  function handleAddExistingTag(tag: DatasetTag) {
    const normalizedTag = {
      ...tag,
      color: normalizeDatasetTagColor(tag.color),
    };

    if (currentTagIdentities.has(getDatasetTagIdentity(normalizedTag))) {
      return;
    }

    setTags((current) => [
      ...current,
      {
        id: createTagId(),
        label: normalizedTag.label,
        color: normalizedTag.color,
      },
    ]);
    setErrorMessage(null);
  }

  function handleDisplayedFieldChange(columnKey: string, checked: boolean) {
    setHiddenColumnKeys((current) =>
      checked
        ? current.filter((key) => key !== columnKey)
        : [...current, columnKey],
    );
    setErrorMessage(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!trimmedFileName) {
      setErrorMessage("The dataset name cannot be empty.");
      return;
    }

    if (
      trimmedFileName === dataset.fileName &&
      !hasTagChanges &&
      !hasHiddenColumnChanges &&
      !hasPrimaryChange
    ) {
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
        isPrimary,
        hiddenColumnKeys: normalizedHiddenColumnKeys,
      });
      onOpenChange(false);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The dataset name could not be updated.",
      );
    }
  }

  function handleReplaceDataset() {
    onOpenChange(false);
    router.push(`/dashboard/upload?replace=${dataset.id}`);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 sm:max-w-lg"
        data-smoke-surface="dataset-edit-sheet"
        data-smoke-ready="dataset-edit-sheet"
      >
        <form className="flex h-full flex-col" onSubmit={handleSubmit}>
          <SheetHeader className="border-b border-border px-6 py-5">
            <SheetTitle>Edit dataset</SheetTitle>
            <SheetDescription>
              Configure the dataset details for everyone who can view it.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-6 overflow-y-auto overscroll-contain px-6 py-5">
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

            <section className="space-y-3">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  Primary dataset
                </p>
                <p className="text-sm text-muted-foreground">
                  Show this dataset by default when someone opens Data.
                </p>
              </div>

              <FieldLabel
                htmlFor="dataset-is-primary"
                className="rounded-2xl border border-border bg-card p-0!"
              >
                <Field
                  orientation="horizontal"
                  className="items-start justify-between gap-4 px-4 py-4"
                >
                  <FieldContent className="gap-1.5">
                    <FieldTitle className="text-sm font-medium">
                      Use as the default Data view
                    </FieldTitle>
                    <FieldDescription className="text-sm leading-5">
                      Only one dataset can be primary at a time. Selecting this
                      clears the primary flag from any other dataset.
                    </FieldDescription>
                  </FieldContent>
                  <Checkbox
                    id="dataset-is-primary"
                    checked={isPrimary}
                    disabled={isSaving}
                    onCheckedChange={(checked) => setIsPrimary(!!checked)}
                    aria-label="Set dataset as primary"
                  />
                </Field>
              </FieldLabel>
            </section>

            <section className="space-y-4">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  Displayed fields
                </p>
                <p className="text-sm text-muted-foreground">
                  Hide columns from the dataset table without changing the
                  stored data or the filters that use it.
                </p>
              </div>

              <div className="overflow-hidden rounded-2xl border border-border bg-card">
                <div className="max-h-72 divide-y divide-border overflow-y-auto">
                  {dataset.columns.map((column) => {
                    const isVisible = !normalizedHiddenColumnKeys.includes(column.key);

                    return (
                      <label
                        key={column.key}
                        className="flex cursor-pointer items-start justify-between gap-4 px-4 py-3"
                        htmlFor={`dataset-visible-field-${column.key}`}
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">
                            {column.label}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {isVisible ? "Shown in the dataset table" : "Hidden from the dataset table"}
                          </p>
                        </div>
                        <Checkbox
                          id={`dataset-visible-field-${column.key}`}
                          checked={isVisible}
                          disabled={isSaving}
                          aria-label={`Show ${column.label} in the dataset table`}
                          onCheckedChange={(checked) =>
                            handleDisplayedFieldChange(column.key, !!checked)
                          }
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
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

              {reusableTags.length > 0 ? (
                <div className="space-y-3 rounded-2xl border border-border bg-card px-4 py-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      Saved tags
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Reuse tags that already exist on other datasets.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {reusableTags.map((tag) => (
                      <button
                        key={getDatasetTagIdentity(tag)}
                        type="button"
                        disabled={isSaving}
                        className="inline-flex items-center rounded-full border px-2.5 py-1 text-[0.72rem] font-medium leading-none text-[var(--dataset-tag-text-light)] transition-opacity hover:opacity-75 disabled:cursor-not-allowed disabled:opacity-45 dark:text-[var(--dataset-tag-text-dark)]"
                        style={getDatasetTagStyle(tag.color)}
                        onClick={() => handleAddExistingTag(tag)}
                      >
                        {tag.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

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

          <SheetFooter className="border-t border-border px-6 py-4 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={isSaving}
              onClick={handleReplaceDataset}
            >
              Replace dataset
            </Button>
            <SheetClose
              render={
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSaving}
                  data-smoke-close="dataset-edit-sheet"
                />
              }
            >
              Close
            </SheetClose>
            <Button type="submit" disabled={!canSave}>
              {isSaving ? "Saving..." : "Save changes"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
