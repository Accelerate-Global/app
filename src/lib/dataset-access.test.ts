import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { workspaceVisibleDataset } from "@/lib/dataset-access";

describe("workspaceVisibleDataset", () => {
  it("requires both a visible view and a visible physical source", () => {
    const query = new PgDialect().sqlToQuery(workspaceVisibleDataset()).sql;

    expect(query).toContain('"datasets"."is_workspace_visible"');
    expect(query).toContain('backing_source.id = "datasets"."backing_dataset_id"');
    expect(query).toContain("backing_source.is_workspace_visible");
  });
});
