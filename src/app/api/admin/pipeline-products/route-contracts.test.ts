import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const routeFiles = [
  "src/app/api/admin/pipeline-products/route.ts",
  "src/app/api/admin/pipeline-products/releases/route.ts",
  "src/app/api/admin/pipeline-products/runs/route.ts",
  "src/app/api/admin/pipeline-products/runs/[runId]/route.ts",
  "src/app/api/admin/pipeline-products/runs/[runId]/reject/route.ts",
  "src/app/api/admin/pipeline-products/runs/[runId]/publish/route.ts",
  "src/app/api/admin/pipeline-products/runs/[runId]/download/route.ts",
  "src/app/api/admin/pipeline-products/targets/[publicationTargetKey]/rollback/route.ts",
];

describe("pipeline products API contracts", () => {
  it("uses the centralized admin route guard for every operation", async () => {
    for (const file of routeFiles) {
      const source = await readFile(file, "utf8");
      expect(source, file).toContain('from "@/lib/route-guard"');
      expect(source, file).toContain("withRoute(");
      expect(source, file).toContain('access: "admin"');
    }
  });
});
