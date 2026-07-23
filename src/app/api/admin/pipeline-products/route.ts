import {
  getPipelineProductSystemState,
  listEligibleIdentityPublications,
  listPipelineDefinitions,
  listPipelineProductPublications,
  listPipelineReleaseSets,
  listPipelineRuns,
} from "@/lib/pipeline-products";
import { logError } from "@/lib/error-logging";
import { jsonError } from "@/lib/http";
import { withRoute } from "@/lib/route-guard";

export const GET = withRoute(
  { access: "admin", action: "operate data pipelines" },
  async () => {
    try {
      const [system, eligibleIdentityPublications, releases, publications, runs] = await Promise.all([
        getPipelineProductSystemState(),
        listEligibleIdentityPublications(),
        listPipelineReleaseSets(),
        listPipelineProductPublications(),
        listPipelineRuns(),
      ]);
      return Response.json({
        system,
        definitions: listPipelineDefinitions().map((definition) => ({
          key: definition.key,
          stage: definition.stage,
          displayName: definition.displayName,
          version: definition.version,
          checksum: definition.checksum,
          requiredInputKeys: definition.requiredInputKeys,
          outputClassification: definition.outputClassification,
          publicationTargetKey: definition.publicationTargetKey,
        })),
        eligibleIdentityPublications,
        releases,
        publications,
        runs,
      });
    } catch (error) {
      logError("Failed to load pipeline product operations", error);
      return jsonError("Could not load pipeline product operations.", 500);
    }
  },
);
