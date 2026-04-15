import type { CsvColumn } from "@/lib/api-types";

export const MAX_CSV_BYTES = 25 * 1024 * 1024;
export const ROW_BATCH_SIZE = 500;

const HEADER_MAX_LENGTH = 96;

function normalizeHeaderFragment(value: string) {
  return value
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, HEADER_MAX_LENGTH);
}

export function sanitizeFileName(fileName: string) {
  const cleaned = fileName
    .trim()
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return cleaned || "upload.csv";
}

export function normalizeHeaderIdentity(value: unknown, index = 0) {
  const raw = String(value ?? "").trim();
  const normalized = normalizeHeaderFragment(raw);

  return normalized || `column_${index + 1}`;
}

export function normalizeHeader(value: unknown, index: number) {
  const raw = String(value ?? "").trim();
  const normalized = normalizeHeaderFragment(raw);

  return normalized || `column_${index + 1}`;
}

export function normalizeHeaders(headers: unknown[]) {
  const counts = new Map<string, number>();

  return headers.map((header, index): CsvColumn => {
    const baseKey = normalizeHeader(header, index);
    const count = counts.get(baseKey) ?? 0;
    counts.set(baseKey, count + 1);

    return {
      key: count === 0 ? baseKey : `${baseKey}_${count + 1}`,
      label: String(header ?? "").trim() || `Column ${index + 1}`,
      sourceIndex: index,
    };
  });
}

export function rowArrayToRecord(row: unknown[], columns: CsvColumn[]) {
  return columns.reduce<Record<string, string>>((record, column) => {
    const value = row[column.sourceIndex];
    record[column.key] = value == null ? "" : String(value);
    return record;
  }, {});
}

export function chunkRows<T>(rows: T[], size = ROW_BATCH_SIZE) {
  if (size <= 0) {
    throw new Error("Chunk size must be greater than zero.");
  }

  const chunks: T[][] = [];
  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }
  return chunks;
}

export function isCsvFile(file: File) {
  return (
    file.name.toLowerCase().endsWith(".csv") ||
    file.type === "text/csv" ||
    file.type === "application/vnd.ms-excel"
  );
}
