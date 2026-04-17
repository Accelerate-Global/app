"use client";

import { DownloadIcon, PanelRightOpenIcon } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import type { SavedDatasetTable } from "@/lib/api-types";

type SavedTablesGridProps = {
  savedTables: SavedDatasetTable[];
  onOpenDetails: (savedTableId: string) => void;
};

const SAVED_TABLE_GRID_TEMPLATE_COLUMNS =
  "minmax(18rem,1fr) minmax(14rem,0.8fr) minmax(10rem,max-content) 10rem";

function SavedTableActions({
  savedTable,
  onOpenDetails,
}: {
  savedTable: SavedDatasetTable;
  onOpenDetails: (savedTableId: string) => void;
}) {
  return (
    <div className="flex w-full justify-end text-right">
      <ButtonGroup>
        <a
          data-slot="button"
          className={buttonVariants({ variant: "outline", size: "icon-sm" })}
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
          data-smoke-trigger="saved-table-detail-sheet"
          data-smoke-write="safe"
          data-smoke-saved-table-id={savedTable.id}
          onClick={() => onOpenDetails(savedTable.id)}
        >
          <PanelRightOpenIcon />
          Details
        </Button>
      </ButtonGroup>
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
      <span>Source dataset</span>
      <span className="block w-full text-center">People Groups</span>
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
  return (
    <div
      className="grid items-center gap-4 px-5 py-4"
      style={{ gridTemplateColumns: SAVED_TABLE_GRID_TEMPLATE_COLUMNS }}
      data-smoke-saved-table-row={savedTable.id}
    >
      <div className="min-w-0 space-y-1">
        <p className="truncate font-medium text-foreground">{savedTable.name}</p>
        {savedTable.details ? (
          <p className="truncate text-sm text-muted-foreground">{savedTable.details}</p>
        ) : (
          <p className="truncate text-sm text-muted-foreground">
            No details added yet.
          </p>
        )}
      </div>

      <span className="truncate text-sm text-muted-foreground">
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
          Saved Tables
        </h2>
        <p className="text-sm text-muted-foreground">
          Personal filtered tables you have saved from dataset detail views.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-background">
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
    </section>
  );
}
