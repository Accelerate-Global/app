import { desc, eq } from "drizzle-orm";

import { getDb } from "@/db";
import {
  datasetFormingResourceBindings,
  datasetFormingRuns,
} from "@/db/schema";

import { datasetFormingEngineRegistry } from "./registered-engines";

export function listDatasetFormingEnginesUsingResource(resourceKey: string) {
  return datasetFormingEngineRegistry
    .list()
    .filter((engine) =>
      engine.resourceRequirements.some(
        (requirement) => requirement.key === resourceKey,
      ),
    )
    .map((engine) => ({
      engineKey: engine.engineKey,
      displayName: engine.displayName,
      sourceProfileKeys: [...engine.sourceProfileKeys],
      publicationTargetKey: engine.publicationTargetKey,
    }));
}

export async function getDatasetFormingResourceImpact(input: {
  resourceKey: string;
  currentVersionId: string;
  currentChecksum: string;
}) {
  const rows = await getDb()
    .select({
      formingRunId: datasetFormingRuns.id,
      sourceProfileKey: datasetFormingRuns.sourceProfileKey,
      engineKey: datasetFormingRuns.engineKey,
      status: datasetFormingRuns.status,
      datasetId: datasetFormingRuns.datasetId,
      createdAt: datasetFormingRuns.createdAt,
      resourceVersionId: datasetFormingResourceBindings.resourceVersionId,
      checksum: datasetFormingResourceBindings.checksum,
    })
    .from(datasetFormingResourceBindings)
    .innerJoin(
      datasetFormingRuns,
      eq(datasetFormingResourceBindings.formingRunId, datasetFormingRuns.id),
    )
    .where(eq(datasetFormingResourceBindings.bindingKey, input.resourceKey))
    .orderBy(desc(datasetFormingRuns.createdAt));

  return {
    resourceKey: input.resourceKey,
    affectedEngines: listDatasetFormingEnginesUsingResource(input.resourceKey),
    olderBindings: rows
      .filter(
        (row) =>
          row.resourceVersionId !== input.currentVersionId ||
          row.checksum !== input.currentChecksum,
      )
      .map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
      })),
  };
}

export type DatasetFormingResourceImpact = Awaited<
  ReturnType<typeof getDatasetFormingResourceImpact>
>;
