import type { CSSProperties } from "react";

import type { DatasetClassification, DatasetTag } from "@/lib/api-types";

export const DATASET_TAG_COLOR_OPTIONS = [
  {
    label: "White",
    color: "#f7f6ef",
  },
  {
    label: "Purple",
    color: "#262531",
  },
  {
    label: "Yellow",
    color: "#fcab2a",
  },
  {
    label: "Sage",
    color: "#cad3b8",
  },
  {
    label: "Blue",
    color: "#078bc9",
  },
] as const;

export const DEFAULT_DATASET_TAG_COLOR = "#262531";
export const DEFAULT_DATASET_CLASSIFICATION: DatasetClassification = "PGAC";
export const DATASET_CLASSIFICATION_OPTIONS = [
  {
    value: "PGAC",
    label: "PGAC",
    color: "#fcab2a",
  },
  {
    value: "PGIC",
    label: "PGIC",
    color: "#078bc9",
  },
  ] as const satisfies readonly {
  value: DatasetClassification;
  label: string;
  color: string;
}[];

const DATASET_CLASSIFICATION_COLOR_BY_VALUE = Object.fromEntries(
  DATASET_CLASSIFICATION_OPTIONS.map((option) => [option.value, option.color]),
) as Record<DatasetClassification, string>;

function isHexColor(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value);
}

function toDatasetClassification(value: string) {
  const normalizedValue = value.trim().toUpperCase();

  return DATASET_CLASSIFICATION_OPTIONS.find(
    (option) => option.value === normalizedValue,
  )?.value ?? null;
}

function normalizeDatasetTagLabel(value: string) {
  return toDatasetClassification(value) ?? value.trim();
}

export function normalizeDatasetTagColor(value: string | undefined) {
  const nextValue = (value ?? "").trim();

  if (isHexColor(nextValue)) {
    return nextValue.toLowerCase();
  }

  if (/^[0-9a-f]{6}$/i.test(nextValue)) {
    return `#${nextValue.toLowerCase()}`;
  }

  return DEFAULT_DATASET_TAG_COLOR;
}

export function normalizeDatasetTags(tags: DatasetTag[]): DatasetTag[] {
  return tags
    .map((tag) => ({
      id: tag.id.trim(),
      label: normalizeDatasetTagLabel(tag.label),
      color: normalizeDatasetTagColor(tag.color),
    }))
    .filter((tag) => tag.id.length > 0 && tag.label.length > 0);
}

export function isDatasetClassificationLabel(value: string) {
  return toDatasetClassification(value) !== null;
}

export function isDatasetClassificationTag(
  value: Pick<DatasetTag, "label"> | string,
) {
  return isDatasetClassificationLabel(
    typeof value === "string" ? value : value.label,
  );
}

export function getDatasetClassificationTags(tags: DatasetTag[]) {
  return normalizeDatasetTags(tags).filter((tag) => isDatasetClassificationTag(tag));
}

export function getDatasetClassification(tags: DatasetTag[]) {
  const classifications = [
    ...new Set(
      getDatasetClassificationTags(tags)
        .map((tag) => toDatasetClassification(tag.label))
        .filter((classification): classification is DatasetClassification =>
          classification !== null,
        ),
    ),
  ];

  return classifications.length === 1 ? classifications[0] : null;
}

export function hasExactDatasetClassificationTag(tags: DatasetTag[]) {
  return getDatasetClassificationTags(tags).length === 1;
}

export function getDatasetTagsWithoutClassification(tags: DatasetTag[]) {
  return normalizeDatasetTags(tags).filter(
    (tag) => !isDatasetClassificationTag(tag),
  );
}

export function composeDatasetTagsWithClassification(
  tags: DatasetTag[],
  classification: DatasetClassification,
) {
  const normalizedTags = normalizeDatasetTags(tags);
  const existingClassificationTag = normalizedTags.find((tag) =>
    isDatasetClassificationTag(tag),
  );

  return [
    ...getDatasetTagsWithoutClassification(normalizedTags),
    {
      id:
        existingClassificationTag?.id ||
        `dataset-classification-${classification.toLowerCase()}`,
      label: classification,
      color: DATASET_CLASSIFICATION_COLOR_BY_VALUE[classification],
    },
  ];
}

export function getDatasetTitleFromTags(tags: DatasetTag[]) {
  const classification =
    hasExactDatasetClassificationTag(tags) && getDatasetClassification(tags)
      ? getDatasetClassification(tags)
      : null;

  return `${classification ?? DEFAULT_DATASET_CLASSIFICATION} Dataset`;
}

export function getDatasetTagIdentity(tag: Pick<DatasetTag, "label" | "color">) {
  return `${tag.label.trim().toLowerCase()}::${normalizeDatasetTagColor(tag.color)}`;
}

export function getReusableDatasetTags(tags: DatasetTag[]) {
  const seen = new Set<string>();

  return getDatasetTagsWithoutClassification(tags)
    .filter((tag) => {
      const identity = getDatasetTagIdentity(tag);

      if (seen.has(identity)) {
        return false;
      }

      seen.add(identity);
      return true;
    })
    .sort((left, right) => left.label.localeCompare(right.label));
}

function hexToRgb(value: string) {
  const normalized = normalizeDatasetTagColor(value);

  return {
    red: Number.parseInt(normalized.slice(1, 3), 16),
    green: Number.parseInt(normalized.slice(3, 5), 16),
    blue: Number.parseInt(normalized.slice(5, 7), 16),
  };
}

function toRgba(value: string, alpha: number) {
  const color = hexToRgb(value);
  return `rgba(${color.red}, ${color.green}, ${color.blue}, ${alpha})`;
}

function mixRgbChannel(start: number, end: number, ratio: number) {
  return Math.round(start + (end - start) * ratio);
}

function mixHexColors(start: string, end: string, ratio: number) {
  const startColor = hexToRgb(start);
  const endColor = hexToRgb(end);

  return `rgb(${mixRgbChannel(startColor.red, endColor.red, ratio)}, ${mixRgbChannel(startColor.green, endColor.green, ratio)}, ${mixRgbChannel(startColor.blue, endColor.blue, ratio)})`;
}

function getDatasetTagLightTextColor(value: string) {
  const color = hexToRgb(value);
  const brightness =
    (color.red * 299 + color.green * 587 + color.blue * 114) / 1000;

  return brightness > 170 ? "#262531" : value;
}

function getDatasetTagDarkTextColor(value: string) {
  const color = hexToRgb(value);
  const brightness =
    (color.red * 299 + color.green * 587 + color.blue * 114) / 1000;

  return brightness > 170 ? value : mixHexColors(value, "#f5f1e8", 0.72);
}

type DatasetTagStyle = CSSProperties & {
  "--dataset-tag-text-light": string;
  "--dataset-tag-text-dark": string;
};

export function getDatasetTagStyle(color: string): DatasetTagStyle {
  const normalizedColor = normalizeDatasetTagColor(color);

  return {
    "--dataset-tag-text-light": getDatasetTagLightTextColor(normalizedColor),
    "--dataset-tag-text-dark": getDatasetTagDarkTextColor(normalizedColor),
    borderColor: toRgba(normalizedColor, 0.34),
    backgroundColor: toRgba(normalizedColor, 0.14),
  };
}
