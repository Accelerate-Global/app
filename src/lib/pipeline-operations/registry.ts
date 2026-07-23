import { createHash } from "node:crypto";

import { datasetFormingEngineRegistry } from "@/lib/dataset-forming";
import { AX_IDENTITY_RULES_CHECKSUM } from "@/lib/identity-registry/semantic-contract";
import { AX_IDENTITY_RULES_VERSION } from "@/lib/identity-registry/types";
import { listPipelineDefinitions } from "@/lib/pipeline-products/definitions";
import { TIER2_PRODUCT_DEFINITIONS } from "@/lib/tier2-products/definitions";
import {
  TIER2_PARTNER_FLOW_SEMANTIC_DEPENDENCIES,
} from "@/lib/tier2-products/semantic-contracts";

import { getPipelineSourceAdapterMetadata } from "./source-execution";

import type {
  PipelineDefinitionSemanticDependency,
  PipelineFlowDefinition,
  PipelineStageDefinition,
  PipelineStageKind,
} from "./types";

const VERSION = "pipeline-operations-v1";

type StageInput = Omit<PipelineStageDefinition, "maxAttempts"> & {
  maxAttempts?: number;
};

function stage(
  key: string,
  label: string,
  kind: PipelineStageKind,
  input: Omit<StageInput, "key" | "label" | "kind" | "description"> & {
    description?: string;
  },
): PipelineStageDefinition {
  return Object.freeze({
    key,
    label,
    description: input.description ?? label,
    kind,
    effectKey: input.effectKey,
    maxAttempts: input.maxAttempts ?? (kind === "review" ? 1 : 3),
    ...(input.sourceProfileKey ? { sourceProfileKey: input.sourceProfileKey } : {}),
    ...(input.productKey ? { productKey: input.productKey } : {}),
  });
}

function sourceStages(sourceProfileKey: string, label: string) {
  return [
    stage(`${sourceProfileKey}-ingest`, `Ingest ${label}`, "ingestion", {
      effectKey: "source-ingestion",
      sourceProfileKey,
    }),
    stage(`${sourceProfileKey}-form`, `Form ${label}`, "forming", {
      effectKey: "source-forming",
      sourceProfileKey,
    }),
    stage(`${sourceProfileKey}-review`, `Review ${label}`, "review", {
      effectKey: "manual-review",
      sourceProfileKey,
      description: `Review the formed ${label} candidate and its findings.`,
    }),
    stage(`${sourceProfileKey}-publish`, `Publish ${label}`, "publication", {
      effectKey: "source-publish",
      sourceProfileKey,
      description: `Publish the explicitly approved ${label} candidate as an immutable source publication.`,
    }),
  ] as const;
}

function identityStages(sourceProfileKey: string, label: string) {
  return [
    stage(`${sourceProfileKey}-identity`, `Reconcile ${label} identities`, "identity", {
      effectKey: "identity-reconcile",
      sourceProfileKey,
    }),
    stage(`${sourceProfileKey}-identity-review`, `Review ${label} identities`, "review", {
      effectKey: "manual-review",
      sourceProfileKey,
      description: `Review the AX identity assignments for ${label}.`,
    }),
    stage(`${sourceProfileKey}-identity-publish`, `Publish ${label} identities`, "publication", {
      effectKey: "identity-publish",
      sourceProfileKey,
    }),
  ] as const;
}

const tier1Sources = [
  ["imb-people-groups", "IMB people groups"],
  ["etnopedia-people-groups", "Etnopedia people groups"],
  ["joshua-project-pgic", "Joshua Project people groups"],
  ["wcd-people-groups", "World Christian Database people groups"],
  ["accelerate-owned-people-groups", "Accelerate-owned people groups"],
] as const;

const aggregate1Products = [
  ["aggregate1-pgac", "PGAC Aggregate 1"],
  ["aggregate1-self-engaged", "Self-Engaged"],
  ["aggregate1-watchlist", "Watchlist"],
  ["aggregate1-baseline-uupg", "Baseline UUPG"],
  ["aggregate1-hotspots", "Baseline UUPG Hotspots"],
  ["aggregate1-south-asia", "South Asia"],
] as const;

function productStages(
  key: string,
  label: string,
  kind: "merge" | "aggregate",
) {
  return [
    stage(key, `Build ${label}`, kind, {
      effectKey: kind === "merge" ? "tier1-merge" : "aggregate1-build",
      productKey: key,
    }),
    stage(`${key}-review`, `Review ${label}`, "review", {
      effectKey: "manual-review",
      productKey: key,
      description: `Review the ${label} candidate, lineage, and findings.`,
    }),
    stage(`${key}-publish`, `Publish ${label}`, "publication", {
      effectKey: "pipeline-product-publish",
      productKey: key,
      description: `Publish the explicitly approved ${label} candidate to its stable target.`,
    }),
  ] as const;
}

function semanticDependenciesForStages(
  stages: readonly PipelineStageDefinition[],
): PipelineDefinitionSemanticDependency[] {
  const dependencies = new Map<string, PipelineDefinitionSemanticDependency>();
  const add = (dependency: PipelineDefinitionSemanticDependency) => {
    const identity = `${dependency.kind}:${dependency.key}`;
    const existing = dependencies.get(identity);
    if (
      existing &&
      (existing.version !== dependency.version ||
        existing.checksum !== dependency.checksum)
    ) {
      throw new Error(`Pipeline semantic dependency ${identity} is inconsistent.`);
    }
    dependencies.set(identity, dependency);
  };
  const productDefinitions = new Map(
    listPipelineDefinitions().map((item) => [item.key, item]),
  );

  for (const item of stages) {
    if (item.effectKey === "identity-reconcile") {
      add({
        kind: "transformation-contract",
        key: "ax-identity-rules",
        version: AX_IDENTITY_RULES_VERSION,
        checksum: AX_IDENTITY_RULES_CHECKSUM,
      });
    }

    if (item.sourceProfileKey) {
      const adapter = getPipelineSourceAdapterMetadata(item.sourceProfileKey);
      add({
        kind: "source-adapter",
        key: adapter.key,
        version: adapter.version,
        checksum: adapter.checksum,
      });
      const resolution = datasetFormingEngineRegistry.resolveBySourceProfile(
        item.sourceProfileKey,
      );
      if (resolution.status === "registered") {
        add({
          kind: "source-engine",
          key: resolution.engine.engineKey,
          version: resolution.engine.version,
          checksum: resolution.engine.checksum,
        });
        for (const requirement of resolution.engine.resourceRequirements) {
          if (requirement.bindingType !== "code") continue;
          add({
            kind: requirement.contractType === "field-contract"
              ? "field-contract"
              : "transformation-contract",
            key: requirement.key,
            version: requirement.version,
            checksum: requirement.checksum,
          });
        }
      }
      if (item.sourceProfileKey === "tier2-partner") {
        for (const dependency of TIER2_PARTNER_FLOW_SEMANTIC_DEPENDENCIES) {
          add(dependency);
        }
      }
    }

    if (item.productKey) {
      const tier1 = productDefinitions.get(item.productKey);
      const tier2 = item.productKey === "tier2" || item.productKey === "aggregate2"
        ? TIER2_PRODUCT_DEFINITIONS[item.productKey]
        : null;
      const product = tier1 ?? tier2;
      if (product) {
        add({
          kind: "product-definition",
          key: item.productKey,
          version: product.version,
          checksum: product.checksum,
        });
      }
    }
  }

  return [...dependencies.values()].sort((left, right) =>
    `${left.kind}:${left.key}`.localeCompare(`${right.kind}:${right.key}`),
  );
}

export function checksumPipelineFlowDefinition(
  input: Omit<PipelineFlowDefinition, "checksum">,
) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        key: input.key,
        label: input.label,
        description: input.description,
        version: input.version,
        scheduleEligible: input.scheduleEligible,
        semanticDependencies: input.semanticDependencies,
        stages: input.stages,
      }),
    )
    .digest("hex");
}

function definition(
  input: Omit<PipelineFlowDefinition, "checksum" | "semanticDependencies">,
) {
  const semanticDependencies = semanticDependenciesForStages(input.stages);
  const semanticDefinition = { ...input, semanticDependencies };
  const checksum = checksumPipelineFlowDefinition(semanticDefinition);

  return Object.freeze({
    ...semanticDefinition,
    checksum,
  }) satisfies PipelineFlowDefinition;
}

const sourceDefinitions = tier1Sources.map(([key, label]) =>
  definition({
    key: `source-${key}`,
    label,
    description: `Ingest, form, review, and publish ${label}.`,
    version: VERSION,
    scheduleEligible: true,
    stages: sourceStages(key, label),
  }),
);

const tier1ProductStages = aggregate1Products.flatMap(([key, label]) =>
  productStages(key, label, "aggregate"),
);

const definitions = [
  ...sourceDefinitions,
  definition({
    key: "tier1-release",
    label: "Tier 1 release",
    description: "Pin exact identity publications, finalize a reviewed release, and build all Tier 1 products.",
    version: VERSION,
    scheduleEligible: false,
    stages: [
      stage("tier1-release-set", "Validate Tier 1 release candidate", "release", {
        effectKey: "release-set-build",
      }),
      stage("tier1-release-review", "Review Tier 1 release inputs", "review", {
        effectKey: "manual-review",
      }),
      stage("tier1-release-finalize", "Finalize Tier 1 release set", "release", {
        effectKey: "release-set-finalize",
      }),
      ...productStages("tier1-pgic-merge", "Tier 1 PGIC merge", "merge"),
      ...productStages("tier1-specific-pg-merge", "Tier 1 specific people groups", "merge"),
      ...tier1ProductStages,
    ],
  }),
  definition({
    key: "tier1-full",
    label: "Complete Tier 1",
    description: "Run all five Tier 1 sources, identity reconciliation, release selection, merges, and Aggregate 1 products.",
    version: VERSION,
    scheduleEligible: false,
    stages: [
      ...tier1Sources.flatMap(([key, label]) => [
        ...sourceStages(key, label),
        ...identityStages(key, label),
      ]),
      stage("tier1-release-set", "Validate Tier 1 release candidate", "release", {
        effectKey: "release-set-build",
      }),
      stage("tier1-release-review", "Review Tier 1 release inputs", "review", {
        effectKey: "manual-review",
      }),
      stage("tier1-release-finalize", "Finalize Tier 1 release set", "release", {
        effectKey: "release-set-finalize",
      }),
      ...productStages("tier1-pgic-merge", "Tier 1 PGIC merge", "merge"),
      ...productStages("tier1-specific-pg-merge", "Tier 1 specific people groups", "merge"),
      ...tier1ProductStages,
    ],
  }),
  definition({
    key: "tier2-partner",
    label: "Tier 2 partner source",
    description: "Ingest and form one exact engagement-partner source and reconcile its identities.",
    version: VERSION,
    scheduleEligible: true,
    stages: [
      stage("tier2-partner-ingest", "Ingest engagement partner", "ingestion", {
        effectKey: "source-ingestion",
        sourceProfileKey: "tier2-partner",
      }),
      stage("tier2-partner-form", "Form engagement partner", "forming", {
        effectKey: "tier2-forming",
        sourceProfileKey: "tier2-partner",
      }),
      stage("tier2-partner-review", "Review partner candidate", "review", {
        effectKey: "manual-review",
      }),
      stage("tier2-partner-publish", "Publish partner candidate", "publication", {
        effectKey: "tier2-forming-publish",
        sourceProfileKey: "tier2-partner",
      }),
      stage("tier2-partner-identity", "Reconcile partner identities", "identity", {
        effectKey: "tier2-identity-reconcile",
        sourceProfileKey: "tier2-partner",
      }),
      stage("tier2-partner-identity-review", "Review partner identities", "review", {
        effectKey: "manual-review",
        sourceProfileKey: "tier2-partner",
      }),
      stage("tier2-partner-identity-publish", "Publish partner identities", "publication", {
        effectKey: "tier2-identity-publish",
        sourceProfileKey: "tier2-partner",
      }),
    ],
  }),
  definition({
    key: "tier2-release",
    label: "Tier 2 release and Aggregate 2",
    description: "Pin an exact partner release, build the Tier 2 union, and build Aggregate 2 from exact publications.",
    version: VERSION,
    scheduleEligible: false,
    stages: [
      stage("tier2-release-set", "Validate Tier 2 release candidate", "release", {
        effectKey: "tier2-release-set-build",
      }),
      stage("tier2-release-review", "Review Tier 2 release inputs", "review", {
        effectKey: "manual-review",
      }),
      stage("tier2-merge", "Build Tier 2 release", "merge", {
        effectKey: "tier2-merge",
        productKey: "tier2",
      }),
      stage("tier2-merge-review", "Review Tier 2 release", "review", {
        effectKey: "manual-review",
        productKey: "tier2",
      }),
      stage("tier2-merge-publish", "Publish Tier 2 release", "publication", {
        effectKey: "tier2-product-publish",
        productKey: "tier2",
      }),
      stage("aggregate2", "Build Aggregate 2", "aggregate", {
        effectKey: "aggregate2-build",
        productKey: "aggregate2",
      }),
      stage("aggregate2-review", "Review Aggregate 2", "review", {
        effectKey: "manual-review",
        productKey: "aggregate2",
      }),
      stage("aggregate2-publish", "Publish Aggregate 2", "publication", {
        effectKey: "tier2-product-publish",
        productKey: "aggregate2",
      }),
    ],
  }),
] as const;

const registry = new Map(definitions.map((item) => [item.key, item]));

export function listPipelineFlowDefinitions() {
  return [...definitions];
}

export function getPipelineFlowDefinition(key: string) {
  return registry.get(key) ?? null;
}

export function requirePipelineFlowDefinition(key: string) {
  const value = getPipelineFlowDefinition(key);
  if (!value) throw new Error(`Unknown pipeline flow definition: ${key}`);
  return value;
}
