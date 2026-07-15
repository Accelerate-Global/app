"use client";

import { AlertTriangleIcon, CheckCircle2Icon, Loader2Icon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type {
  GoogleSheetsHeaderPreview,
  GoogleSheetsHeaderSelectionInput,
} from "@/lib/api-types";

type GoogleSheetsHeaderSelectionProps = {
  preview: GoogleSheetsHeaderPreview | null;
  selection: GoogleSheetsHeaderSelectionInput | null;
  isLoading?: boolean;
  disabled?: boolean;
  onChange: (selection: GoogleSheetsHeaderSelectionInput) => void;
};

function candidateLabel(candidate: GoogleSheetsHeaderPreview["candidates"][number]) {
  const sample = candidate.values.filter(Boolean).slice(0, 2).join(" · ");
  return `Row ${candidate.rowNumber}${sample ? ` — ${sample}` : ""}`;
}

export function GoogleSheetsHeaderSelection({
  preview,
  selection,
  isLoading = false,
  disabled = false,
  onChange,
}: GoogleSheetsHeaderSelectionProps) {
  if (!preview || !selection) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
        <Loader2Icon className="size-4 animate-spin" />
        Detecting the header row…
      </div>
    );
  }

  const rowCount = selection.endRow - selection.startRow + 1;
  const maxRowCount = Math.min(3, preview.inspectedRowCount - selection.startRow + 1);
  const confidenceNeedsReview =
    selection.mode === "auto" && preview.selected.confidence !== "high";

  return (
    <div
      className="space-y-4 rounded-lg border border-border bg-background p-4"
      data-smoke-surface="google-sheets-header-selection"
      data-smoke-ready="google-sheets-header-selection"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="font-medium text-foreground">{preview.sheetTitle}</h4>
          <p className="text-xs text-muted-foreground">
            Choose the row that contains the import column titles.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">Recommended row {preview.recommendedRow}</Badge>
          <Badge variant={confidenceNeedsReview ? "destructive" : "secondary"}>
            {preview.selected.confidence} confidence
          </Badge>
        </div>
      </div>

      {confidenceNeedsReview ? (
        <div className="flex items-start gap-2 rounded-md bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-100">
          <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
          Review the headers before connecting. The Sheet structure is ambiguous.
        </div>
      ) : (
        <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300">
          <CheckCircle2Icon className="size-4" />
          Data begins after row {selection.endRow}.
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1.5 text-sm font-medium">
          Header row
          <select
            aria-label={`Header row for ${preview.sheetTitle}`}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={selection.startRow}
            disabled={disabled || isLoading}
            onChange={(event) => {
              const startRow = Number(event.target.value);
              onChange({
                ...selection,
                mode: "manual",
                startRow,
                endRow: Math.min(startRow + rowCount - 1, preview.inspectedRowCount),
              });
            }}
          >
            {preview.candidates.map((candidate) => (
              <option key={candidate.rowNumber} value={candidate.rowNumber}>
                {candidateLabel(candidate)}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1.5 text-sm font-medium">
          Header rows to combine
          <select
            aria-label={`Header rows to combine for ${preview.sheetTitle}`}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={rowCount}
            disabled={disabled || isLoading}
            onChange={(event) => {
              const nextCount = Number(event.target.value);
              onChange({
                ...selection,
                mode: nextCount === 1 && selection.startRow === preview.recommendedRow
                  ? "auto"
                  : "manual",
                endRow: selection.startRow + nextCount - 1,
              });
            }}
          >
            {Array.from({ length: maxRowCount }, (_, index) => index + 1).map(
              (count) => (
                <option key={count} value={count}>
                  {count === 1 ? "One row" : `${count} rows`}
                </option>
              ),
            )}
          </select>
        </label>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Resulting columns and sample data
        </div>
        <div className="overflow-x-auto rounded-md border">
          <table className="min-w-max text-left text-xs">
            <thead className="bg-muted/60">
              <tr>
                {preview.selected.headers.map((header, index) => (
                  <th
                    key={`${header}-${index}`}
                    className="max-w-64 border-r px-3 py-2 font-semibold last:border-r-0"
                  >
                    {header || `Column ${index + 1}`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.sampleRows.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-t">
                  {preview.selected.headers.map((_, columnIndex) => (
                    <td
                      key={columnIndex}
                      className="max-w-64 truncate border-r px-3 py-2 last:border-r-0"
                    >
                      {row[columnIndex] || "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
