"use client";

import { PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type {
  DatasetClassification,
  DatasetSummary,
  DatasetTag,
  DatasetVersionSummary,
} from "@/lib/api-types";
import {
  buildAnalyticsContext,
  type AnalyticsWorkspaceRole,
  withAnalyticsContext,
} from "@/lib/analytics";
import { trackAppEvent } from "@/lib/analytics-client";
import { normalizeDatasetHiddenColumnKeys } from "@/lib/dataset-column-visibility";
import {
  composeDatasetTagsWithClassification,
  DATASET_CLASSIFICATION_OPTIONS,
  DATASET_TAG_COLOR_OPTIONS,
  DEFAULT_DATASET_TAG_COLOR,
  getDatasetClassification,
  getDatasetTagIdentity,
  getDatasetTagsWithoutClassification,
  getDatasetTagStyle,
  hasExactDatasetClassificationTag,
  isDatasetClassificationLabel,
  normalizeDatasetTagColor,
  normalizeDatasetTags,
} from "@/lib/dataset-tags";

type DatasetResponse = {
  dataset: DatasetSummary;
};

type DatasetVersionsResponse = {
  versions: DatasetVersionSummary[];
};

type DatasetEditPageClientProps = {
  initialDataset: DatasetSummary;
  backingDatasetName?: string | null;
  availableTags: DatasetTag[];
  initialVersions: DatasetVersionSummary[];
  actorOwnerId?: string;
  workspaceRole?: AnalyticsWorkspaceRole;
};

type DatasetEditFormProps = {
  dataset: DatasetSummary;
  backingDatasetName?: string | null;
  availableTags: DatasetTag[];
  versions: DatasetVersionSummary[];
  isSaving: boolean;
  isDeleting: boolean;
  isLoadingVersions: boolean;
  versionHistoryError: string | null;
  revertingVersionId: string | null;
  onCancel: () => void;
  onSaveDataset: (input: {
    datasetId: string;
    fileName: string;
    tags: DatasetTag[];
    isPrimary: boolean;
    isPublic: boolean;
    hiddenColumnKeys: string[];
  }) => Promise<void>;
  onDeleteDataset: (datasetId: string) => Promise<void>;
  onReplaceDataset: () => void;
  onRevertDatasetVersion: (versionId: string) => Promise<void>;
};

async function getErrorMessage(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error || fallback;
  } catch {
    return fallback;
  }
}

async function updateDatasetRecord(input: {
  datasetId: string;
  fileName: string;
  tags: DatasetTag[];
  isPrimary: boolean;
  isPublic: boolean;
  hiddenColumnKeys: string[];
}) {
  const response = await fetch(`/api/datasets/${input.datasetId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: input.fileName,
      tags: input.tags,
      isPrimary: input.isPrimary,
      isPublic: input.isPublic,
      hiddenColumnKeys: input.hiddenColumnKeys,
    }),
  });

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        "The dataset details could not be updated.",
      ),
    );
  }

  return ((await response.json()) as DatasetResponse).dataset;
}

async function deleteDatasetRecord(datasetId: string) {
  const response = await fetch(`/api/datasets/${datasetId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(response, "The dataset could not be deleted."),
    );
  }

  return ((await response.json()) as DatasetResponse).dataset;
}

async function listDatasetVersionRecords(datasetId: string) {
  const response = await fetch(`/api/datasets/${datasetId}/versions`);

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        "The dataset upload history could not be loaded.",
      ),
    );
  }

  return ((await response.json()) as DatasetVersionsResponse).versions;
}

async function revertDatasetVersionRecord(input: {
  datasetId: string;
  versionId: string;
}) {
  const response = await fetch(
    `/api/datasets/${input.datasetId}/versions/${input.versionId}/revert`,
    {
      method: "POST",
    },
  );

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(response, "The dataset version could not be reverted."),
    );
  }

  return ((await response.json()) as DatasetResponse).dataset;
}

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

function DatasetClassificationMenu({
  value,
  disabled,
  onChange,
}: {
  value: DatasetClassification | null;
  disabled: boolean;
  onChange: (value: DatasetClassification) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor="dataset-classification">Dataset classification</Label>
      <Select
        value={value ?? undefined}
        onValueChange={(nextValue) => {
          if (nextValue === "PGAC" || nextValue === "PGIC") {
            onChange(nextValue);
          }
        }}
        disabled={disabled}
      >
        <SelectTrigger
          id="dataset-classification"
          aria-label="Dataset classification"
          data-smoke-dataset-classification
        >
          <SelectValue placeholder="Select PGAC or PGIC" />
        </SelectTrigger>
        <SelectContent align="start">
          {DATASET_CLASSIFICATION_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              <span
                className="size-3 rounded-full border border-border"
                style={getDatasetTagStyle(option.color)}
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

function DatasetEditForm({
  dataset,
  backingDatasetName = null,
  availableTags,
  versions,
  isSaving,
  isDeleting,
  isLoadingVersions,
  versionHistoryError,
  revertingVersionId,
  onCancel,
  onSaveDataset,
  onDeleteDataset,
  onReplaceDataset,
  onRevertDatasetVersion,
}: DatasetEditFormProps) {
  const isDerivedView = dataset.backingDatasetId != null;
  const sourceDatasetLabel = backingDatasetName ?? "its source dataset";
  const initialClassification = useMemo(
    () => (isDerivedView ? null : getDatasetClassification(dataset.tags)),
    [dataset.tags, isDerivedView],
  );
  const hasValidInitialClassification = useMemo(
    () => (isDerivedView ? true : hasExactDatasetClassificationTag(dataset.tags)),
    [dataset.tags, isDerivedView],
  );
  const [fileName, setFileName] = useState(dataset.fileName);
  const [isPrimary, setIsPrimary] = useState(dataset.isPrimary);
  const [isPublic, setIsPublic] = useState(dataset.isPublic);
  const [classification, setClassification] = useState<DatasetClassification | null>(
    initialClassification,
  );
  const [tags, setTags] = useState(() =>
    getDatasetTagsWithoutClassification(dataset.tags),
  );
  const [hiddenColumnKeys, setHiddenColumnKeys] = useState(() =>
    normalizeDatasetHiddenColumnKeys(dataset.hiddenColumnKeys, dataset.columns),
  );
  const [newTagLabel, setNewTagLabel] = useState("");
  const [newTagColor, setNewTagColor] = useState(DEFAULT_DATASET_TAG_COLOR);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const nextTagIdRef = useRef(0);

  const trimmedFileName = fileName.trim();
  const selectedDatasetLabel = trimmedFileName || dataset.fileName;
  const replaceButtonLabel = isDerivedView
    ? `Replace ${selectedDatasetLabel}`
    : "Replace dataset";
  const normalizedTags = useMemo(() => normalizeDatasetTags(tags), [tags]);
  const normalizedAvailableTags = useMemo(
    () => getDatasetTagsWithoutClassification(availableTags),
    [availableTags],
  );
  const normalizedHiddenColumnKeys = useMemo(
    () => normalizeDatasetHiddenColumnKeys(hiddenColumnKeys, dataset.columns),
    [dataset.columns, hiddenColumnKeys],
  );
  const initialTags = useMemo(
    () => getDatasetTagsWithoutClassification(dataset.tags),
    [dataset.tags],
  );
  const initialHiddenColumnKeys = useMemo(
    () => normalizeDatasetHiddenColumnKeys(dataset.hiddenColumnKeys, dataset.columns),
    [dataset.columns, dataset.hiddenColumnKeys],
  );
  const hasTagChanges =
    JSON.stringify(normalizedTags) !== JSON.stringify(initialTags);
  const hasClassificationChange =
    !isDerivedView &&
    ((classification ?? null) !== (initialClassification ?? null) ||
      (!hasValidInitialClassification && classification !== null));
  const hasHiddenColumnChanges =
    JSON.stringify(normalizedHiddenColumnKeys) !==
    JSON.stringify(initialHiddenColumnKeys);
  const hasPrimaryChange = isPrimary !== dataset.isPrimary;
  const hasPublicChange = isPublic !== dataset.isPublic;
  const isWorking = isSaving || isDeleting || revertingVersionId !== null;
  const canSave = Boolean(
    trimmedFileName &&
      !isWorking &&
      (trimmedFileName !== dataset.fileName ||
        hasClassificationChange ||
        hasTagChanges ||
        hasHiddenColumnChanges ||
        hasPrimaryChange ||
        hasPublicChange),
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
      normalizedAvailableTags.filter(
        (tag) => !currentTagIdentities.has(getDatasetTagIdentity(tag)),
      ),
    [currentTagIdentities, normalizedAvailableTags],
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

    if (isDatasetClassificationLabel(label)) {
      setErrorMessage("PGAC and PGIC are managed by dataset classification.");
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
    if (isDatasetClassificationLabel(tag.label)) {
      setErrorMessage("PGAC and PGIC are managed by dataset classification.");
      return;
    }

    const normalizedTag = normalizeDatasetTags([tag])[0];

    if (!normalizedTag) {
      return;
    }

    if (currentTagIdentities.has(getDatasetTagIdentity(normalizedTag))) {
      return;
    }

    setTags((current) => {
      return [
        ...current,
        {
          id: createTagId(),
          label: normalizedTag.label,
          color: normalizedTag.color,
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
      !hasPrimaryChange &&
      !hasPublicChange
    ) {
      setErrorMessage(null);
      return;
    }

    if (tags.some((tag) => tag.label.trim().length === 0)) {
      setErrorMessage("Each tag needs text or should be removed.");
      return;
    }

    if (!isDerivedView && !classification) {
      setErrorMessage("Select PGAC or PGIC for this source dataset.");
      return;
    }

    setErrorMessage(null);

    try {
      const nextTags = isDerivedView
        ? normalizedTags
        : composeDatasetTagsWithClassification(normalizedTags, classification!);
      await onSaveDataset({
        datasetId: dataset.id,
        fileName: trimmedFileName,
        tags: nextTags,
        isPrimary,
        isPublic,
        hiddenColumnKeys: normalizedHiddenColumnKeys,
      });
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
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The dataset could not be deleted.",
      );
    }
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
    <form
      className="overflow-hidden rounded-3xl border border-border bg-background"
      onSubmit={handleSubmit}
    >
      <div className="border-b border-border px-6 py-5">
        <h2 className="text-xl font-semibold tracking-[-0.02em]">Edit dataset</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure the dataset details for everyone who can view it.
        </p>
      </div>

      <div className="space-y-6 px-6 py-5">
        <section className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
            Current dataset
          </p>
          <div className="rounded-2xl border border-border bg-card px-4 py-3">
            <p className="font-medium text-foreground">{dataset.fileName}</p>
          </div>
          {isDerivedView ? (
            <p className="text-sm text-muted-foreground">
              This dataset is currently a derived view backed by{" "}
              <span className="font-medium text-foreground">
                {sourceDatasetLabel}
              </span>
              . You can still edit its name, tags, displayed fields, and default
              preset, but it cannot be primary while it depends on another
              dataset. Replacing{" "}
              <span className="font-medium text-foreground">
                {selectedDatasetLabel}
              </span>{" "}
              will convert it into its own source dataset with independent upload
              history.{" "}
              <span className="font-medium text-foreground">
                {sourceDatasetLabel}
              </span>{" "}
              stays unchanged unless you replace it directly.
            </p>
          ) : null}
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

        {!isDerivedView ? (
          <section className="space-y-2">
            <DatasetClassificationMenu
              value={classification}
              disabled={isWorking}
              onChange={(nextClassification) => {
                setClassification(nextClassification);
                setErrorMessage(null);
              }}
            />
            <p className="text-sm text-muted-foreground">
              This drives the dataset detail title and is required for every
              source dataset.
            </p>
            {!hasValidInitialClassification ? (
              <p className="text-sm text-muted-foreground">
                This dataset needs a PGAC or PGIC classification before it can
                be saved again.
              </p>
            ) : null}
          </section>
        ) : null}

        <section className="space-y-3 rounded-2xl border border-border bg-card px-4 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <label
                className="text-sm font-medium text-foreground"
                htmlFor="dataset-is-public"
              >
                Public dataset
              </label>
              <p className="text-sm text-muted-foreground">
                Keep this enabled to show the dataset to non-admin users across
                the dashboard, detail pages, downloads, and saved views.
              </p>
              {!isPublic ? (
                <p className="text-sm text-muted-foreground">
                  This dataset is currently hidden from non-admin users.
                </p>
              ) : null}
            </div>

            <Switch
              id="dataset-is-public"
              checked={isPublic}
              disabled={isWorking}
              aria-label="Set dataset visibility for non-admin users"
              data-smoke-dataset-public-toggle
              onCheckedChange={(checked) => {
                setIsPublic(checked);
                if (!checked) {
                  setIsPrimary(false);
                }
              }}
            />
          </div>
        </section>

        <section className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">Primary dataset</p>
            <p className="text-sm text-muted-foreground">
              {isDerivedView
                ? "Derived dataset views cannot be shown as the default source dataset."
                : !isPublic
                  ? "Hidden datasets cannot be shown as the default source dataset."
                : "Show this dataset by default when someone opens Data."}
            </p>
            {!isDerivedView && isPublic ? (
              <p className="text-sm leading-5 text-muted-foreground">
                Only one dataset can be primary at a time. Selecting this clears
                the primary flag from any other dataset.
              </p>
            ) : null}
          </div>

          <Checkbox
            id="dataset-is-primary"
            checked={isPrimary}
            disabled={isWorking || isDerivedView || !isPublic}
            onCheckedChange={(checked) => setIsPrimary(!!checked)}
            aria-label="Set dataset as primary"
          />
        </section>

        <section className="space-y-4">
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">Displayed fields</p>
            <p className="text-sm text-muted-foreground">
              Hide columns from the dataset table without changing the stored
              data or the filters that use it.
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
                        {isVisible
                          ? "Shown in the dataset table"
                          : "Hidden from the dataset table"}
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
                <p className="text-sm font-medium text-foreground">Saved tags</p>
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
          <p className="text-sm text-muted-foreground">{uploadedAt}</p>
        </section>

        <section className="space-y-4">
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">Upload history</p>
            <p className="text-sm text-muted-foreground">
              {isDerivedView
                ? "Derived dataset views reuse a backing dataset until they are replaced with their own source CSV."
                : "Review prior uploads and revert this dataset if needed."}
            </p>
          </div>

          {isDerivedView ? (
            <div className="rounded-2xl border border-dashed border-border px-4 py-4 text-sm text-muted-foreground">
              Use <span className="font-medium text-foreground">{replaceButtonLabel}</span>{" "}
              to upload a new CSV for this dataset. This creates an independent
              source dataset for{" "}
              <span className="font-medium text-foreground">
                {selectedDatasetLabel}
              </span>
              {" "}and starts its own upload history.{" "}
              <span className="font-medium text-foreground">
                {sourceDatasetLabel}
              </span>{" "}
              stays unchanged unless you replace it separately.
            </div>
          ) : isLoadingVersions ? (
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
                            {version.isCurrent
                              ? "Current"
                              : formatVersionActionLabel(version.action)}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {version.rowCount.toLocaleString()} rows ·{" "}
                          {version.columnCount.toLocaleString()} columns
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

      <div className="border-t border-border px-6 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            disabled={isWorking}
            data-smoke-dataset-replace
            onClick={onReplaceDataset}
          >
            {replaceButtonLabel}
          </Button>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              disabled={isWorking}
              onClick={onCancel}
            >
              Cancel
            </Button>
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
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-start">
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
      </div>
    </form>
  );
}

export function DatasetEditPageClient({
  initialDataset,
  backingDatasetName = null,
  availableTags,
  initialVersions,
  actorOwnerId = "anonymous",
  workspaceRole = "anonymous",
}: DatasetEditPageClientProps) {
  const router = useRouter();
  const [dataset, setDataset] = useState(initialDataset);
  const [versions, setVersions] = useState(initialVersions);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  const [versionHistoryError, setVersionHistoryError] = useState<string | null>(
    null,
  );
  const [revertingVersionId, setRevertingVersionId] = useState<string | null>(
    null,
  );
  const analyticsContext = buildAnalyticsContext({
    route: "dataset_edit",
    actorOwnerId,
    workspaceRole,
  });

  async function handleSaveDataset(input: {
    datasetId: string;
    fileName: string;
    tags: DatasetTag[];
    isPrimary: boolean;
    isPublic: boolean;
    hiddenColumnKeys: string[];
  }) {
    if (isSaving || isDeleting || revertingVersionId !== null) {
      return;
    }

    setIsSaving(true);
    const saveStartTime = Date.now();

    try {
      await updateDatasetRecord(input);
      trackAppEvent(
        "dataset_metadata_saved",
        withAnalyticsContext(analyticsContext, {
          source_surface: "dataset_edit_form",
          success: true,
          dataset_id: input.datasetId,
          renamed: input.fileName !== dataset.fileName,
          primary_changed: input.isPrimary !== dataset.isPrimary,
          visibility_changed: input.isPublic !== dataset.isPublic,
          is_public: input.isPublic,
          hidden_column_count: input.hiddenColumnKeys.length,
          tag_count: input.tags.length,
          duration_ms: Date.now() - saveStartTime,
        }),
      );
      router.push("/dashboard");
    } catch (error) {
      trackAppEvent(
        "dataset_metadata_saved",
        withAnalyticsContext(analyticsContext, {
          source_surface: "dataset_edit_form",
          success: false,
          error_code: "dataset_metadata_save_failed",
          dataset_id: input.datasetId,
          renamed: input.fileName !== dataset.fileName,
          primary_changed: input.isPrimary !== dataset.isPrimary,
          visibility_changed: input.isPublic !== dataset.isPublic,
          is_public: input.isPublic,
          hidden_column_count: input.hiddenColumnKeys.length,
          tag_count: input.tags.length,
          duration_ms: Date.now() - saveStartTime,
        }),
      );
      throw new Error(
        error instanceof Error
          ? error.message
          : "The dataset details could not be updated.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteDataset(datasetId: string) {
    if (isSaving || isDeleting || revertingVersionId !== null) {
      return;
    }

    setIsDeleting(true);
    const deleteStartTime = Date.now();

    try {
      await deleteDatasetRecord(datasetId);
      trackAppEvent(
        "dataset_deleted",
        withAnalyticsContext(analyticsContext, {
          source_surface: "dataset_edit_form",
          success: true,
          dataset_id: datasetId,
          duration_ms: Date.now() - deleteStartTime,
        }),
      );
      router.push("/dashboard");
    } catch (error) {
      trackAppEvent(
        "dataset_deleted",
        withAnalyticsContext(analyticsContext, {
          source_surface: "dataset_edit_form",
          success: false,
          error_code: "dataset_delete_failed",
          dataset_id: datasetId,
          duration_ms: Date.now() - deleteStartTime,
        }),
      );
      throw new Error(
        error instanceof Error
          ? error.message
          : "The dataset could not be deleted.",
      );
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleRevertDatasetVersion(versionId: string) {
    if (isSaving || isDeleting || revertingVersionId !== null) {
      return;
    }

    setRevertingVersionId(versionId);
    const revertStartTime = Date.now();

    try {
      const revertedDataset = await revertDatasetVersionRecord({
        datasetId: dataset.id,
        versionId,
      });

      setDataset(revertedDataset);
      setVersionHistoryError(null);
      setIsLoadingVersions(true);

      try {
        const nextVersions = await listDatasetVersionRecords(revertedDataset.id);
        setVersions(nextVersions);
      } catch (error) {
        setVersionHistoryError(
          error instanceof Error
            ? error.message
            : "The dataset upload history could not be loaded.",
        );
      } finally {
        setIsLoadingVersions(false);
      }
      trackAppEvent(
        "dataset_version_reverted",
        withAnalyticsContext(analyticsContext, {
          source_surface: "dataset_version_history",
          success: true,
          dataset_id: dataset.id,
          version_id: versionId,
          duration_ms: Date.now() - revertStartTime,
        }),
      );
    } catch (error) {
      trackAppEvent(
        "dataset_version_reverted",
        withAnalyticsContext(analyticsContext, {
          source_surface: "dataset_version_history",
          success: false,
          error_code: "dataset_version_revert_failed",
          dataset_id: dataset.id,
          version_id: versionId,
          duration_ms: Date.now() - revertStartTime,
        }),
      );
      throw new Error(
        error instanceof Error
          ? error.message
          : "The dataset version could not be reverted.",
      );
    } finally {
      setRevertingVersionId(null);
    }
  }

  return (
    <DatasetEditForm
      key={`${dataset.id}:${dataset.updatedAt}`}
      dataset={dataset}
      backingDatasetName={backingDatasetName}
      availableTags={availableTags}
      versions={versions}
      isSaving={isSaving}
      isDeleting={isDeleting}
      isLoadingVersions={isLoadingVersions}
      versionHistoryError={versionHistoryError}
      revertingVersionId={revertingVersionId}
      onCancel={() => router.push("/dashboard")}
      onSaveDataset={handleSaveDataset}
      onDeleteDataset={handleDeleteDataset}
      onReplaceDataset={() =>
        router.push(
          `/dashboard/upload?replace=${dataset.id}`,
        )
      }
      onRevertDatasetVersion={handleRevertDatasetVersion}
    />
  );
}
