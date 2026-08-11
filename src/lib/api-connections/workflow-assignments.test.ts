import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

describe("existing connection workflow persistence", () => {
  it("serializes, conflict-checks, and persists inside one transaction", async () => {
    const source = await readFile(
      path.join(
        process.cwd(),
        "src/lib/api-connections/workflow-assignments.ts",
      ),
      "utf8",
    );
    const start = source.indexOf(
      "export async function assignGoogleSheetsConnectionWorkflow",
    );
    const assignmentSource = source.slice(start);

    expect(assignmentSource).toContain("getDb().transaction(async (tx) =>");
    expect(assignmentSource).toContain("for update");
    expect(assignmentSource).toContain(
      "This connection is already linked to a data workflow.",
    );
    expect(assignmentSource).toContain(
      "persistGoogleSheetsWorkflowAssignments({",
    );
    expect(assignmentSource).not.toContain("getDb().update(apiConnections)");
  });

  it("updates classification only alongside its private workflow record", async () => {
    const source = await readFile(
      path.join(
        process.cwd(),
        "src/lib/api-connections/workflow-assignments.ts",
      ),
      "utf8",
    );
    const persistenceStart = source.indexOf(
      "export async function persistGoogleSheetsWorkflowAssignments",
    );
    const persistenceEnd = source.indexOf(
      "export async function getGoogleSheetsConnectionWorkflow",
      persistenceStart,
    );
    const persistenceSource = source.slice(persistenceStart, persistenceEnd);

    expect(persistenceSource).toContain(".insert(sourceProfileBindings)");
    expect(persistenceSource).toContain(
      "insert into private.tier2_partner_profiles",
    );
    expect(persistenceSource).toContain("tracking_id_source_column");
    expect(persistenceSource).toContain("tracking_id_source_mappings");
    expect(persistenceSource).toContain('datasetClassification: "PGIC"');
    expect(persistenceSource).toContain('datasetClassification: "PGAC"');
  });
});
