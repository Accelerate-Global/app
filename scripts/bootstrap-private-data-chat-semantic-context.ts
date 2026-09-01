import { pathToFileURL } from "node:url";

import { closeDb } from "@/db";
import {
  createPrivateDataChatSemanticContextCandidate,
  getActivePrivateDataChatSemanticContext,
} from "@/lib/private-data-chat/semantic-context-candidate";
import {
  activateReferenceResource,
  ReferenceResourceNotFoundError,
} from "@/lib/reference-resources";
import { SEMANTIC_CONTEXT_RESOURCE_KEY } from "@/lib/reference-resources/types";

import { configureLocalReferenceResourceEnvironment } from "./bootstrap-reference-resources";

const BOOTSTRAP_ACTOR = "system:semantic-context-bootstrap";

type SemanticBootstrapDependencies = {
  createCandidate: typeof createPrivateDataChatSemanticContextCandidate;
  getActive: typeof getActivePrivateDataChatSemanticContext;
  activate: typeof activateReferenceResource;
  closeDb: typeof closeDb;
};

const defaultDependencies: SemanticBootstrapDependencies = {
  createCandidate: createPrivateDataChatSemanticContextCandidate,
  getActive: getActivePrivateDataChatSemanticContext,
  activate: activateReferenceResource,
  closeDb,
};

export async function runBootstrapPrivateDataChatSemanticContext(
  dependencies: SemanticBootstrapDependencies = defaultDependencies,
) {
  try {
    let activeVersionId: string | null = null;
    try {
      activeVersionId = (await dependencies.getActive()).version.id;
    } catch (error) {
      if (!(error instanceof ReferenceResourceNotFoundError)) throw error;
    }

    const candidate = await dependencies.createCandidate({
      actorOwnerId: BOOTSTRAP_ACTOR,
    });
    let activated = false;
    if (candidate.version.id !== activeVersionId) {
      if (candidate.version.lifecycleState !== "valid") {
        throw new Error(
          "The generated semantic-context candidate did not pass validation.",
        );
      }
      await dependencies.activate({
        resourceKey: SEMANTIC_CONTEXT_RESOURCE_KEY,
        versionId: candidate.version.id,
        expectedActiveVersionId: activeVersionId,
        actorOwnerId: BOOTSTRAP_ACTOR,
        reason: activeVersionId
          ? "Reconcile reviewed semantic context"
          : "Initial reviewed semantic-context bootstrap",
      });
      activated = true;
    }

    return {
      status: "ok" as const,
      resourceKey: SEMANTIC_CONTEXT_RESOURCE_KEY,
      versionId: candidate.version.id,
      versionNumber: candidate.version.versionNumber,
      checksum: candidate.version.contentChecksum,
      entryCount: candidate.version.entryCount,
      unchanged: candidate.unchanged && !activated,
      activated,
      findings: candidate.findings,
    };
  } finally {
    await dependencies.closeDb();
  }
}

async function main() {
  if (process.argv.includes("--local")) {
    await configureLocalReferenceResourceEnvironment();
  }
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
  console.log(
    JSON.stringify(await runBootstrapPrivateDataChatSemanticContext(), null, 2),
  );
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
