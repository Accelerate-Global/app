"use client";

import { PlusIcon, Trash2Icon, XIcon } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  DatasetSummary,
  DatasetTag,
  DatasetVersionSummary,
} from "@/lib/api-types";
import { normalizeDatasetHiddenColumnKeys } from "@/lib/dataset-column-visibility";
import {
  DATASET_TAG_COLOR_OPTIONS,
  DEFAULT_DATASET_TAG_COLOR,
  getDatasetTagIdentity,
  getDatasetTagStyle,
  normalizeDatasetTagColor,
  normalizeDatasetTags,
} from "@/lib/dataset-tags";
import {
  getUnsupportedDatasetOpenPresetSections,
  type DatasetOpenPresetSection,
} from "@/lib/saved-dataset-filters";

type DatasetEditSheetProps = {
  dataset: DatasetSummary;
  availableTags: DatasetTag[];
  versions: DatasetVersionSummary[];
  open: boolean;
  isSaving: boolean;
  isDeleting: boolean;
  isLoadingVersions: boolean;
  versionHistoryError: string | null;
  revertingVersionId: string | null;
  onOpenChange: (open: boolean) => void;
  onSaveDataset: (input: {
    datasetId: string;
    fileName: string;
    tags: DatasetTag[];
    isPrimary: boolean;
    hiddenColumnKeys: string[];
  }) => Promise<void>;
  onDeleteDataset: (datasetId: string) => Promise<void>;
  onRevertDatasetVersion: (versionId: string) => Promise<void>;
};

function formatUploadedAt(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatVersionActionLabel(action: DatasetVersionSummary["action"]) {
  if (action === "replace") {
    return "Replace";
  }

  if (action === "revert") {
    return "Revert";
  }

  return "Upload";
}

function getDatasetTagColorOption(value: string | undefined) {
  const normalizedValue = normalizeDatasetTagColor(value);

  return (
    DATASET_TAG_COLOR_OPTIONS.find((option) => option.color === normalizedValue) ??
    DATASET_TAG_COLOR_OPTIONS[0]
  );
}

function formatDatasetOpenPresetSection(
  section: DatasetOpenPresetSection,
) {
  if (section === "uupg") {
    return "UUPG";
  }

  if (section === "watchlist") {
    return "Watchlist";
  }

  return `${section.charAt(0).toUpperCase()}${section.slice(1)}`;
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
  const activeOption = getDatasetTagColorOption(value);

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
          <SelectValue>
            {(selectedValue) => {
              const selectedOption = getDatasetTagColorOption(
                typeof selectedValue === "string" ? selectedValue : undefined,
              );

              return (
                <span className="flex items-center gap-2">
                  <span
                    className="size-3 rounded-full border border-border"
                    style={{ backgroundColor: selectedOption.color }}
                  />
                  <span>{selectedOption.label}</span>
                </span>
              );
            }}
          </SelectValue>
        </SelectTrigger>
        <SelectContent align="start" className="w-56">
          <SelectGroup>
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
          </SelectGroup>
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
  versions,
  open,
  isSaving,
  isDeleting,
  isLoadingVersions,
  versionHistoryError,
  revertingVersionId,
  onOpenChange,
  onSaveDataset,
  onDeleteDataset,
  onRevertDatasetVersion,
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
  const isWorking = isSaving || isDeleting || revertingVersionId !== null;
  const canSave = Boolean(
    trimmedFileName &&
      !isWorking &&
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
    const normalizedTag = normalizeDatasetTags([tag])[0];

    if (!normalizedTag) {
      return;
    }

    if (normalizedTag.openPreset) {
      const unsupportedSections = getUnsupportedDatasetOpenPresetSections(
        dataset,
        normalizedTag.openPreset,
      );

      if (unsupportedSections.length > 0) {
        setErrorMessage(
          `The "${normalizedTag.label}" tag preset needs ${unsupportedSections
            .map(formatDatasetOpenPresetSection)
            .join(", ")} filtering support on this dataset.`,
        );
        return;
      }
    }

    if (currentTagIdentities.has(getDatasetTagIdentity(normalizedTag))) {
      return;
    }

    setTags((current) => {
      const nextCurrent = normalizedTag.openPreset
        ? current.map((currentTag) =>
            currentTag.openPreset !== undefined
              ? {
                  ...currentTag,
                  openPreset: undefined,
                }
              : currentTag,
          )
        : current;

      return [
        ...nextCurrent,
        {
          id: createTagId(),
          label: normalizedTag.label,
          color: normalizedTag.color,
          openPreset: normalizedTag.openPreset,
        },
      ];
    });
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

  async function handleDeleteDataset() {
    if (!window.confirm(`Delete the dataset "${dataset.fileName}"?`)) {
      return;
    }

    setErrorMessage(null);

    try {
      await onDeleteDataset(dataset.id);
      onOpenChange(false);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The dataset could not be deleted.",
      );
    }
  }

  function handleReplaceDataset() {
    onOpenChange(false);
    router.push(`/dashboard/upload?replace=${dataset.id}`);
  }

  async function handleRevertVersion(version: DatasetVersionSummary) {
    if (version.isCurrent || version.status !== "ready") {
      return;
    }

    const confirmed = window.confirm(
      `Revert to ${version.fileName} from ${formatUploadedAt(version.versionCreatedAt)}?`,
    );

    if (!confirmed) {
      return;
    }

    setErrorMessage(null);

    try {
      await onRevertDatasetVersion(version.id);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The dataset version could not be reverted.",
      );
    }
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
                disabled={isWorking}
                data-smoke-dataset-name-input
                onChange={(event) => setFileName(event.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                Update the name shown in the dataset list.
              </p>
            </section>

            <section className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  Primary dataset
                </p>
                <p className="text-sm text-muted-foreground">
                  Show this dataset by default when someone opens Data.
                </p>
                <p className="text-sm leading-5 text-muted-foreground">
                  Only one dataset can be primary at a time. Selecting this
                  clears the primary flag from any other dataset.
                </p>
              </div>

              <Checkbox
                id="dataset-is-primary"
                checked={isPrimary}
                disabled={isWorking}
                onCheckedChange={(checked) => setIsPrimary(!!checked)}
                aria-label="Set dataset as primary"
              />
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
                          disabled={isWorking}
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
                disabled={isWorking}
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
                        disabled={isWorking}
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
                      disabled={isWorking}
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
              <p className="text-sm text-muted-foreground">
                {uploadedAt}
              </p>
            </section>

            <section className="space-y-4">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Upload history</p>
                <p className="text-sm text-muted-foreground">
                  Review prior uploads and revert this dataset if needed.
                </p>
              </div>

              {isLoadingVersions ? (
                <div className="rounded-2xl border border-border bg-card px-4 py-4 text-sm text-muted-foreground">
                  Loading upload history...
                </div>
              ) : versions.length > 0 ? (
                <div className="space-y-3">
                  {versions.map((version) => {
                    const actorLabel = version.actorEmail ?? version.actorOwnerId;
                    const isRevertDisabled =
                      isWorking || version.isCurrent || version.status !== "ready";

                    return (
                      <div
                        key={version.id}
                        className="space-y-3 rounded-2xl border border-border bg-card px-4 py-4"
                        data-smoke-dataset-version-row={version.id}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium text-foreground">{version.fileName}</p>
                              <span className="rounded-full border border-border px-2 py-0.5 text-[0.7rem] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                                {version.isCurrent ? "Current" : formatVersionActionLabel(version.action)}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {version.rowCount.toLocaleString()} rows · {version.columnCount.toLocaleString()} columns
                            </p>
                          </div>

                          {!version.isCurrent ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={isRevertDisabled}
                              data-smoke-dataset-version-revert={version.id}
                              onClick={() => void handleRevertVersion(version)}
                            >
                              {revertingVersionId === version.id ? "Reverting..." : "Revert"}
                            </Button>
                          ) : null}
                        </div>

                        <div className="space-y-1 text-sm text-muted-foreground">
                          <p>
                            {version.isCurrent ? "Current since" : "Version from"}{" "}
                            <span className="font-medium text-foreground">
                              {formatUploadedAt(version.versionCreatedAt)}
                            </span>
                          </p>
                          <p>
                            By{" "}
                            <span className="font-medium text-foreground">{actorLabel}</span>
                          </p>
                          {version.archivedAt ? (
                            <p>
                              Archived{" "}
                              <span className="font-medium text-foreground">
                                {formatUploadedAt(version.archivedAt)}
                              </span>
                            </p>
                          ) : null}
                          {version.status !== "ready" ? (
                            <p>
                              Status{" "}
                              <span className="font-medium text-foreground">
                                {version.status}
                              </span>
                            </p>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border px-4 py-4 text-sm text-muted-foreground">
                  No upload history yet.
                </div>
              )}

              {versionHistoryError ? (
                <p className="text-sm text-destructive">{versionHistoryError}</p>
              ) : null}
            </section>

            {errorMessage ? (
              <p className="text-sm text-destructive">{errorMessage}</p>
            ) : null}
          </div>

          <SheetFooter className="border-t border-border px-6 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                disabled={isWorking}
                data-smoke-dataset-replace
                onClick={handleReplaceDataset}
              >
                Replace dataset
              </Button>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                <SheetClose
                  render={
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full sm:w-auto"
                      disabled={isWorking}
                      data-smoke-close="dataset-edit-sheet"
                    />
                  }
                >
                  Close
                </SheetClose>
                <Button
                  type="submit"
                  className="w-full sm:w-auto"
                  disabled={!canSave}
                  data-smoke-dataset-save
                >
                  {isSaving ? "Saving..." : "Save changes"}
                </Button>
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-start">
              <Button
                type="button"
                variant="destructive"
                className="w-full sm:w-auto"
                disabled={isWorking}
                data-smoke-dataset-delete
                onClick={handleDeleteDataset}
              >
                <Trash2Icon />
                {isDeleting ? "Deleting..." : "Delete dataset"}
              </Button>
            </div>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
