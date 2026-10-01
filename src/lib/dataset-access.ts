import { sql } from "drizzle-orm";

import { datasets } from "@/db/schema";

/** Visibility of a derived view cannot exceed its physical source. */
export function workspaceVisibleDataset() {
  return sql<boolean>`${datasets.isWorkspaceVisible} and (
    ${datasets.backingDatasetId} is null
    or exists (
      select 1 from public.datasets as backing_source
      where backing_source.id = ${datasets.backingDatasetId}
        and backing_source.is_workspace_visible
    )
  )`;
}
