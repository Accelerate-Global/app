import type { DatasetTag } from "@/lib/api-types";

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

function getDatasetTagTextColor(value: string) {
  const color = hexToRgb(value);
  const brightness =
    (color.red * 299 + color.green * 587 + color.blue * 114) / 1000;

  return brightness > 170 ? "#262531" : value;
}

export function getDatasetTagStyle(color: string) {
  const normalizedColor = normalizeDatasetTagColor(color);

  return {
    borderColor: toRgba(normalizedColor, 0.34),
    backgroundColor: toRgba(normalizedColor, 0.14),
    color: getDatasetTagTextColor(normalizedColor),
  };
}
