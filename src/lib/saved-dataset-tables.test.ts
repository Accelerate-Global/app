import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";

import { getDb } from "@/db";
import { listSavedDatasetTables } from "@/lib/saved-dataset-tables";

vi.mock("@/db", () => ({ getDb: vi.fn() }));

describe("saved dataset access", () => {
  it("filters saved tables by the view and its backing source visibility", async () => {
    let predicate: Parameters<PgDialect["sqlToQuery"]>[0] | undefined;
    vi.mocked(getDb).mockReturnValue({
      select: () => ({
        from: () => ({
          innerJoin: () => ({
            where: (value: typeof predicate) => {
              predicate = value;
              return { orderBy: async () => [] };
            },
          }),
        }),
      }),
    } as never);

    await expect(listSavedDatasetTables("owner-1")).resolves.toEqual([]);
    expect(predicate).toBeDefined();
    const query = new PgDialect().sqlToQuery(predicate!).sql;
    expect(query).toContain('"datasets"."is_workspace_visible"');
    expect(query).toContain('backing_source.id = "datasets"."backing_dataset_id"');
    expect(query).toContain("backing_source.is_workspace_visible");
  });
});
