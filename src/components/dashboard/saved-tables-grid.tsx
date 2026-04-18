"use client";

import { DownloadIcon, PanelRightOpenIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import type { KeyboardEvent, ReactNode } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import type { SavedDatasetTable } from "@/lib/api-types";

type SavedTablesGridProps = {
  savedTables: SavedDatasetTable[];
  onOpenDetails: (savedTableId: string) => void;
};

const SAVED_TABLE_ACTIONS_COLUMN_WIDTH = "10.5rem";
const SAVED_TABLE_GRID_TEMPLATE_COLUMNS =
  `minmax(16rem,1.8fr) minmax(12rem,1.2fr) minmax(8rem,0.7fr) ${SAVED_TABLE_ACTIONS_COLUMN_WIDTH}`;

function CenteredHeaderCell({ children }: { children: ReactNode }) {
  return (
    <span className="flex w-full items-center justify-center text-center">
      {children}
    </span>
  );
}

function SavedTableActions({
  savedTable,
  onOpenDetails,
}: {
  savedTable: SavedDatasetTable;
  onOpenDetails: (savedTableId: string) => void;
}) {
  return (
    <div className="flex w-full justify-end text-right">
      <div className="flex shrink-0 items-center justify-end gap-2">
        <a
          data-slot="button"
          className={buttonVariants({
            variant: "outline",
            size: "icon-sm",
            className: "shrink-0",
          })}
          href={`/api/saved-tables/${savedTable.id}/download`}
          aria-label={`Download ${savedTable.name}`}
          title={`Download ${savedTable.name}`}
          onClick={(event) => {
            event.stopPropagation();
          }}
        >
          <DownloadIcon />
        </a>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0"
          data-smoke-trigger="saved-table-detail-sheet"
          data-smoke-write="safe"
          data-smoke-saved-table-id={savedTable.id}
          onClick={(event) => {
            event.stopPropagation();
            onOpenDetails(savedTable.id);
          }}
        >
          <PanelRightOpenIcon />
          Details
        </Button>
      </div>
    </div>
  );
}

function SavedTableListHeader() {
  return (
    <div
      className="grid items-center gap-4 border-b border-border bg-muted/80 px-5 py-3 text-sm font-medium text-foreground"
      style={{ gridTemplateColumns: SAVED_TABLE_GRID_TEMPLATE_COLUMNS }}
    >
      <span>Name</span>
      <CenteredHeaderCell>Source dataset</CenteredHeaderCell>
      <CenteredHeaderCell>People Groups</CenteredHeaderCell>
      <span className="block w-full text-right" />
    </div>
  );
}

function SavedTableListRow({
  savedTable,
  onOpenDetails,
}: {
  savedTable: SavedDatasetTable;
  onOpenDetails: (savedTableId: string) => void;
}) {
  const router = useRouter();
  const hasDetails = savedTable.details.trim().length > 0;

  function navigateToSavedTable() {
    router.push(
      `/dashboard/datasets/${savedTable.datasetId}?savedTableId=${savedTable.id}&source=saved_table`,
    );
  }

  function handleRowKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      navigateToSavedTable();
    }
  }

  return (
    <div
      className="grid cursor-pointer items-center gap-4 px-5 py-4 transition-colors hover:bg-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      style={{ gridTemplateColumns: SAVED_TABLE_GRID_TEMPLATE_COLUMNS }}
      data-smoke-saved-table-row={savedTable.id}
      role="link"
      tabIndex={0}
      onClick={navigateToSavedTable}
      onKeyDown={handleRowKeyDown}
    >
      <div className="min-w-0">
        <p className="truncate font-medium text-foreground">{savedTable.name}</p>
        {hasDetails ? (
          <p className="truncate text-sm text-muted-foreground">
            {savedTable.details}
          </p>
        ) : null}
      </div>

      <span className="block w-full truncate text-center text-sm text-muted-foreground">
        {savedTable.datasetFileName}
      </span>

      <span className="block w-full text-center tabular-nums">
        {savedTable.savedRowCount.toLocaleString()}
      </span>

      <SavedTableActions savedTable={savedTable} onOpenDetails={onOpenDetails} />
    </div>
  );
}

export function SavedTablesGrid({
  savedTables,
  onOpenDetails,
}: SavedTablesGridProps) {
  return (
    <section id="saved-tables" className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-[-0.03em] text-foreground">
          Saved Datasets
        </h2>
        <p className="text-sm text-muted-foreground">
          Personal filtered tables you have saved.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-background">
        <div className="min-w-[52rem]">
          <SavedTableListHeader />

          {savedTables.length === 0 ? (
            <div className="px-5 py-10 text-sm text-muted-foreground">
              No saved tables yet.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {savedTables.map((savedTable) => (
                <SavedTableListRow
                  key={savedTable.id}
                  savedTable={savedTable}
                  onOpenDetails={onOpenDetails}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
