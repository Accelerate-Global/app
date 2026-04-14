import type { DatasetTag } from "@/lib/api-types";

export const DEFAULT_DATASET_TAG_COLOR = "#8f9f6f";

function isHexColor(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value);
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

export function normalizeDatasetTags(tags: DatasetTag[]) {
  return tags
    .map((tag) => ({
      id: tag.id.trim(),
      label: tag.label.trim(),
      color: normalizeDatasetTagColor(tag.color),
    }))
    .filter((tag) => tag.id.length > 0 && tag.label.length > 0);
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

export function getDatasetTagStyle(color: string) {
  const normalizedColor = normalizeDatasetTagColor(color);

  return {
    borderColor: toRgba(normalizedColor, 0.34),
    backgroundColor: toRgba(normalizedColor, 0.14),
    color: normalizedColor,
  };
}
