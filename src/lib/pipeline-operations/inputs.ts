import { sql } from "drizzle-orm";

import { getDb } from "@/db";
import { listCodeManagedApiConnections } from "@/lib/api-connections";
import type {
  ApiConnectionHeader,
  ApiConnectionImportMode,
  ApiConnectionMethod,
  ApiConnectionProvider,
  ApiConnectionProviderConfig,
  ApiConnectionResponseFormat,
  DatasetClassification,
} from "@/lib/api-types";
import { checksumDatasetFormingValue } from "@/lib/dataset-forming";
import {
  loadPinnedTier1PriorityRules,
} from "@/lib/reference-resources";
import { TIER1_MERGE_PRIORITIES_RESOURCE_KEY } from "@/lib/reference-resources/pipeline-types";
import { listPipelineDefinitions } from "@/lib/pipeline-products";

import type { PipelineJsonObject } from "./types";
import { createPipelineSourceExecutionBinding } from "./source-execution";

type ResourceSetRow = {
  id: string;
  checksum: string;
};

type ResourceVersionRow = {
  resourceKey: string;
  versionId: string;
  checksum: string;
  versionNumber: number;
  schemaVersion: number;
};

type PublicationRow = {
  producerKey: string;
  publicationId: string;
  producerKind: string;
  sourceProfileKey: string | null;
  publicationTargetKey: string | null;
  outputChecksum: string;
};

type RegistryRevisionRow = {
  registryRevisionId: string;
  checksum: string;
  revisionNumber: number;
};

type ConnectionExecutionRow = {
  connectionMethod: ApiConnectionMethod;
  connectionUrl: string;
  connectionRequestHeaders: ApiConnectionHeader[];
  connectionSecretHeaderNames: string[];
  connectionBodyTemplate: string;
  connectionResponseFormat: ApiConnectionResponseFormat;
  connectionResponseDataPath: string;
  connectionImportMode: ApiConnectionImportMode;
  connectionTargetDatasetId: string | null;
  connectionDatasetName: string;
  connectionDatasetClassification: DatasetClassification;
  connectionProvider: ApiConnectionProvider;
  connectionProviderConfig: ApiConnectionProviderConfig;
};

type SourceProfileBindingRow = ConnectionExecutionRow & {
  profileKey: string;
  connectionId: string;
  stableKeyColumn: string;
  updatedAt: Date | string;
};

type Tier2ProfileRow = ConnectionExecutionRow & {
  id: string;
  profileKey: string;
  connectionId: string;
  contractChecksum: string;
  updatedAt: Date | string;
};

type Tier2TargetRow = {
  productKind: "tier2" | "aggregate2";
  publicationTargetKey: string;
  currentPublicationId: string | null;
  currentPublicationTargetKey: string | null;
  currentProducerKind: string | null;
  currentDatasetId: string | null;
  currentDatasetRecordId: string | null;
  currentOutputChecksum: string | null;
  currentPublicationRowCount: number | null;
  currentDatasetRowCount: number | null;
  currentDatasetStatus: string | null;
};

function rowsOf<Row>(value: unknown) {
  return value as Row[];
}

function connectionFromSnapshotRow(
  connectionId: string,
  row: ConnectionExecutionRow,
) {
  return {
    id: connectionId,
    method: row.connectionMethod,
    url: row.connectionUrl,
    headers: [
      ...row.connectionRequestHeaders.map((header) => ({
        name: header.name,
        value: header.value,
        isSecret: false,
      })),
      ...row.connectionSecretHeaderNames.map((name) => ({
        name,
        value: "",
        isSecret: true,
      })),
    ],
    bodyTemplate: row.connectionBodyTemplate,
    responseFormat: row.connectionResponseFormat,
    responseDataPath: row.connectionResponseDataPath,
    importMode: row.connectionImportMode,
    targetDatasetId: row.connectionTargetDatasetId,
    datasetName: row.connectionDatasetName,
    datasetClassification: row.connectionDatasetClassification,
    provider: row.connectionProvider,
    providerConfig: row.connectionProviderConfig,
  };
}

function assertUniqueProfileBindings(
  bindings: readonly SourceProfileBindingRow[],
) {
  const seen = new Set<string>();
  for (const binding of bindings) {
    if (seen.has(binding.profileKey)) {
      throw new Error(
        `Source profile ${binding.profileKey} has multiple active connection bindings.`,
      );
    }
    seen.add(binding.profileKey);
  }
}

function resolveCurrentTier2Publication(
  target: Tier2TargetRow,
): PublicationRow | null {
  if (!target.currentPublicationId) return null;

  const expectedProducerKind = target.productKind === "tier2"
    ? "tier2-merge"
    : "aggregate2";
  if (
    target.currentPublicationTargetKey !== target.publicationTargetKey ||
    target.currentProducerKind !== expectedProducerKind ||
    !target.currentDatasetId ||
    target.currentDatasetId !== target.currentDatasetRecordId ||
    target.currentDatasetStatus !== "ready" ||
    target.currentPublicationRowCount === null ||
    target.currentPublicationRowCount !== target.currentDatasetRowCount ||
    !target.currentOutputChecksum
  ) {
    throw new Error(
      `The current ${target.productKind} publication target is inconsistent with its stable dataset.`,
    );
  }

  return {
    producerKey: expectedProducerKind,
    publicationId: target.currentPublicationId,
    producerKind: expectedProducerKind,
    sourceProfileKey: null,
    publicationTargetKey: target.publicationTargetKey,
    outputChecksum: target.currentOutputChecksum,
  };
}

export async function snapshotCurrentPipelineInputs(): Promise<PipelineJsonObject> {
  const codeManagedConnections = listCodeManagedApiConnections();
  const snapshot = await getDb().transaction(
    async (tx) => {
      const [
        resourceSets,
        resourceVersions,
        publications,
        revisions,
        configurableProfiles,
        tier2Profiles,
        tier2Contracts,
        tier2Targets,
      ] = await Promise.all([
        tx.execute(sql<ResourceSetRow>`
          select id, content_checksum as checksum
          from private.reference_resource_sets
          order by sequence_number desc
          limit 1
        `),
        tx.execute(sql<ResourceVersionRow>`
          select resource.resource_key as "resourceKey",
            version.id as "versionId", version.content_checksum as checksum,
            version.version_number as "versionNumber",
            version.schema_version as "schemaVersion"
          from private.reference_resource_set_members as member
          join private.reference_resource_sets as resource_set
            on resource_set.id = member.set_id
          join private.reference_resources as resource
            on resource.id = member.resource_id
          join private.reference_resource_versions as version
            on version.id = member.version_id
          where resource_set.id = (
            select id from private.reference_resource_sets
            order by sequence_number desc limit 1
          )
          order by resource.resource_key
        `),
        tx.execute(sql<PublicationRow>`
          select distinct on (
            producer_kind,
            coalesce(source_profile_key, ''),
            coalesce(publication_target_key, '')
          )
            coalesce(source_profile_key, producer_kind) as "producerKey",
            id as "publicationId", producer_kind as "producerKind",
            source_profile_key as "sourceProfileKey",
            publication_target_key as "publicationTargetKey",
            output_checksum as "outputChecksum"
          from private.pipeline_publications
          order by producer_kind, coalesce(source_profile_key, ''),
            coalesce(publication_target_key, ''), created_at desc, id desc
        `),
        tx.execute(sql<RegistryRevisionRow>`
          select id as "registryRevisionId", content_checksum as checksum,
            revision_number as "revisionNumber"
          from private.ax_registry_revisions
          order by revision_number desc
          limit 1
        `),
        tx.execute(sql<SourceProfileBindingRow>`
          select binding.source_profile_key as "profileKey",
            binding.connection_id as "connectionId",
            binding.stable_key_column as "stableKeyColumn",
            binding.updated_at as "updatedAt",
            connection.method as "connectionMethod",
            connection.url as "connectionUrl",
            connection.request_headers as "connectionRequestHeaders",
            connection.secret_header_names as "connectionSecretHeaderNames",
            connection.body_template as "connectionBodyTemplate",
            connection.response_format as "connectionResponseFormat",
            connection.response_data_path as "connectionResponseDataPath",
            connection.import_mode as "connectionImportMode",
            connection.target_dataset_id as "connectionTargetDatasetId",
            connection.dataset_name as "connectionDatasetName",
            connection.dataset_classification as "connectionDatasetClassification",
            connection.provider as "connectionProvider",
            connection.provider_config as "connectionProviderConfig"
          from private.source_profile_bindings as binding
          join private.api_connections as connection
            on connection.id = binding.connection_id
          where connection.archived_at is null
          order by binding.source_profile_key, binding.updated_at desc,
            binding.connection_id
        `),
        tx.execute(sql<Tier2ProfileRow>`
          select profile.id, profile.profile_key as "profileKey",
            profile.api_connection_id as "connectionId",
            profile.contract_checksum as "contractChecksum",
            profile.updated_at as "updatedAt",
            connection.method as "connectionMethod",
            connection.url as "connectionUrl",
            connection.request_headers as "connectionRequestHeaders",
            connection.secret_header_names as "connectionSecretHeaderNames",
            connection.body_template as "connectionBodyTemplate",
            connection.response_format as "connectionResponseFormat",
            connection.response_data_path as "connectionResponseDataPath",
            connection.import_mode as "connectionImportMode",
            connection.target_dataset_id as "connectionTargetDatasetId",
            connection.dataset_name as "connectionDatasetName",
            connection.dataset_classification as "connectionDatasetClassification",
            connection.provider as "connectionProvider",
            connection.provider_config as "connectionProviderConfig"
          from private.tier2_partner_profiles as profile
          join private.api_connections as connection
            on connection.id = profile.api_connection_id
          where profile.active and connection.archived_at is null
          order by profile.profile_key
        `),
        tx.execute(sql<ResourceVersionRow>`
          select resource.resource_key as "resourceKey",
            version.id as "versionId", version.content_checksum as checksum,
            version.version_number as "versionNumber",
            version.schema_version as "schemaVersion"
          from private.tier2_contract_resources as resource
          join private.tier2_contract_resource_versions as version
            on version.id = resource.active_version_id
          where version.lifecycle_state = 'valid'
          order by resource.resource_key
        `),
        tx.execute(sql<Tier2TargetRow>`
          select target.product_kind as "productKind",
            target.publication_target_key as "publicationTargetKey",
            target.current_publication_id as "currentPublicationId",
            publication.publication_target_key as "currentPublicationTargetKey",
            publication.producer_kind as "currentProducerKind",
            publication.dataset_id as "currentDatasetId",
            dataset.id as "currentDatasetRecordId",
            publication.output_checksum as "currentOutputChecksum",
            publication.row_count as "currentPublicationRowCount",
            dataset.row_count as "currentDatasetRowCount",
            dataset.status as "currentDatasetStatus"
          from private.tier2_publication_targets as target
          left join private.pipeline_publications as publication
            on publication.id = target.current_publication_id
          left join public.datasets as dataset
            on dataset.id = publication.dataset_id
          order by target.product_kind
        `),
      ]);

      return {
        resourceSets: rowsOf<ResourceSetRow>(resourceSets),
        resourceVersions: rowsOf<ResourceVersionRow>(resourceVersions),
        publications: rowsOf<PublicationRow>(publications),
        revisions: rowsOf<RegistryRevisionRow>(revisions),
        configurableProfiles: rowsOf<SourceProfileBindingRow>(configurableProfiles),
        tier2Profiles: rowsOf<Tier2ProfileRow>(tier2Profiles),
        tier2Contracts: rowsOf<ResourceVersionRow>(tier2Contracts),
        tier2Targets: rowsOf<Tier2TargetRow>(tier2Targets),
      };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );

  const resourceSet = snapshot.resourceSets[0] ?? null;
  if (!resourceSet) {
    throw new Error("No immutable reference resource set is available.");
  }
  assertUniqueProfileBindings(snapshot.configurableProfiles);

  const priorityVersion = snapshot.resourceVersions.find(
    (binding) => binding.resourceKey === TIER1_MERGE_PRIORITIES_RESOURCE_KEY,
  );
  if (!priorityVersion) {
    throw new Error(
      "The immutable reference set has no Tier 1 merge-priority resource.",
    );
  }
  const priorityRuleBinding = await loadPinnedTier1PriorityRules({
    resourceSetId: resourceSet.id,
    resourceSetChecksum: resourceSet.checksum,
    expectedVersionId: priorityVersion.versionId,
    expectedContentChecksum: priorityVersion.checksum,
  });

  const sourceProfileBindings = [
    ...codeManagedConnections.flatMap((connection) => {
      const profile = connection.sourceProfile;
      if (!profile) return [];
      const binding = {
        connectionId: connection.id,
        profileKey: profile.key,
        engineKey: profile.engineKey,
        stableKeyColumn: profile.stableKeyColumn,
        configurable: false,
      };
      return [[profile.key, {
        ...binding,
        updatedAt: connection.updatedAt,
        checksum: checksumDatasetFormingValue(binding),
      }] as const];
    }),
    ...snapshot.configurableProfiles.map((profile) => {
      const engineKey = profile.profileKey === "wcd-people-groups"
        ? "wcd"
        : "accelerate";
      const binding = {
        connectionId: profile.connectionId,
        profileKey: profile.profileKey,
        engineKey,
        stableKeyColumn: profile.stableKeyColumn,
        configurable: true,
      };
      return [profile.profileKey, {
        ...binding,
        updatedAt: new Date(profile.updatedAt).toISOString(),
        checksum: checksumDatasetFormingValue(binding),
      }] as const;
    }),
  ];
  const activeTier2Profiles = snapshot.tier2Profiles;
  const sourceExecutionBindings = [
    ...codeManagedConnections.flatMap((connection) => {
      const profile = connection.sourceProfile;
      if (!profile) return [];
      return [[profile.key, createPipelineSourceExecutionBinding({
        sourceProfileKey: profile.key,
        connection,
      })] as const];
    }),
    ...snapshot.configurableProfiles.map((profile) => [
      profile.profileKey,
      createPipelineSourceExecutionBinding({
        sourceProfileKey: profile.profileKey,
        connection: connectionFromSnapshotRow(profile.connectionId, profile),
      }),
    ] as const),
    ...snapshot.tier2Profiles.map((profile) => [
      `tier2-partner:${profile.id}`,
      createPipelineSourceExecutionBinding({
        sourceProfileKey: "tier2-partner",
        connection: connectionFromSnapshotRow(profile.connectionId, profile),
      }),
    ] as const),
  ];
  const connectionIds = {
    ...Object.fromEntries(
      sourceProfileBindings.map(([profileKey, binding]) => [
        profileKey,
        binding.connectionId,
      ]),
    ),
    ...(activeTier2Profiles.length === 1
      ? { "tier2-partner": activeTier2Profiles[0]!.connectionId }
      : {}),
    ...Object.fromEntries(
      activeTier2Profiles.map((profile) => [
        `tier2-partner:${profile.id}`,
        profile.connectionId,
      ]),
    ),
  };
  const referenceVersionIds = Object.fromEntries(
    snapshot.resourceVersions.map((resource) => [
      resource.resourceKey,
      resource.versionId,
    ]),
  );
  const currentFormingPublications = new Map(
    snapshot.publications
      .filter((publication) => publication.producerKind === "dataset-forming")
      .map((publication) => [
        publication.producerKey,
        publication.publicationId,
      ]),
  );
  const formingPublicationIds = Object.fromEntries(
    sourceProfileBindings.map(([sourceProfileKey]) => [
      sourceProfileKey,
      currentFormingPublications.get(sourceProfileKey) ?? null,
    ]),
  );
  const identityPublicationIds = Object.fromEntries(
    snapshot.publications
      .filter((publication) => publication.producerKind === "identity")
      .map((publication) => [publication.producerKey, publication.publicationId]),
  );
  const currentTier2Publications = snapshot.tier2Targets.flatMap((target) => {
    const publication = resolveCurrentTier2Publication(target);
    return publication ? [publication] : [];
  });
  const productPublicationIds = Object.fromEntries(
    [
      ...snapshot.publications.filter(
        (publication) =>
          publication.publicationTargetKey &&
          publication.producerKind !== "tier2-merge" &&
          publication.producerKind !== "aggregate2",
      ),
      ...currentTier2Publications,
    ]
      .map((publication) => [
        publication.publicationTargetKey!,
        publication.publicationId,
      ]),
  );
  const tier1ExpectedCurrentPublicationIds = Object.fromEntries(
    listPipelineDefinitions().map((definition) => [
      definition.key,
      productPublicationIds[definition.publicationTargetKey] ?? null,
    ]),
  );
  const registryRevision = snapshot.revisions[0] ?? null;
  const tier2ContractBindings = Object.fromEntries(
    snapshot.tier2Contracts.map((binding) => [binding.resourceKey, binding]),
  );
  const tier2Members = activeTier2Profiles.flatMap((profile) => {
    const publication = snapshot.publications.find(
      (candidate) =>
        candidate.producerKind === "identity" &&
        candidate.sourceProfileKey === profile.profileKey,
    );
    return publication
      ? [{
          inputKey: profile.profileKey,
          publicationId: publication.publicationId,
          expectedChecksum: publication.outputChecksum,
        }]
      : [];
  });
  const aggregate2SourceProfiles = {
    imb: "imb-people-groups",
    jp: "joshua-project-pgic",
  } as const;
  const aggregate2Members = [
    ...currentTier2Publications
      .filter((publication) => publication.publicationTargetKey === "tier2-pgic")
      .map((publication) => ({
        inputKey: "tier2",
        publicationId: publication.publicationId,
        expectedChecksum: publication.outputChecksum,
      })),
    ...Object.entries(aggregate2SourceProfiles).flatMap(
      ([inputKey, sourceProfileKey]) => {
        const publication = snapshot.publications.find(
          (candidate) =>
            candidate.producerKind === "identity" &&
            candidate.sourceProfileKey === sourceProfileKey,
        );
        return publication
          ? [{
              inputKey,
              publicationId: publication.publicationId,
              expectedChecksum: publication.outputChecksum,
            }]
          : [];
      },
    ),
  ];

  return {
    capturedAt: new Date().toISOString(),
    connectionIds,
    sourceProfileBindings: Object.fromEntries(sourceProfileBindings),
    sourceExecutionBindings: Object.fromEntries([
      ...sourceExecutionBindings,
      ...(activeTier2Profiles.length === 1
        ? [[
            "tier2-partner",
            sourceExecutionBindings.find(
              ([key]) => key === `tier2-partner:${activeTier2Profiles[0]!.id}`,
            )?.[1],
          ] as const]
        : []),
    ]),
    resourceSetId: resourceSet.id,
    resourceSetChecksum: resourceSet.checksum,
    referenceVersionIds,
    referenceVersionBindings: Object.fromEntries(
      snapshot.resourceVersions.map((binding) => [binding.resourceKey, binding]),
    ),
    publicationIds: identityPublicationIds,
    formingPublicationIds,
    identityPublicationIds,
    productPublicationIds,
    tier1ExpectedCurrentPublicationIds,
    registryRevisionId: registryRevision?.registryRevisionId ?? null,
    registryRevision,
    tier1RuleBinding: {
      ...priorityRuleBinding.binding,
      version: String(priorityRuleBinding.binding.versionNumber),
      checksum: priorityRuleBinding.binding.contentChecksum,
      priorities: priorityRuleBinding.priorities,
    },
    tier2ProfileIds: Object.fromEntries(
      activeTier2Profiles.map((profile) => [profile.profileKey, profile.id]),
    ),
    tier2ProfileBindings: Object.fromEntries(
      activeTier2Profiles.map((profile) => [profile.profileKey, {
        id: profile.id,
        connectionId: profile.connectionId,
        contractChecksum: profile.contractChecksum,
        updatedAt: new Date(profile.updatedAt).toISOString(),
      }]),
    ),
    ...(activeTier2Profiles.length === 1
      ? { profileId: activeTier2Profiles[0]!.id }
      : {}),
    tier2ContractVersionIds: Object.fromEntries(
      Object.entries(tier2ContractBindings).map(([key, value]) => [
        key,
        value.versionId,
      ]),
    ),
    tier2ContractBindings,
    tier2ExpectedCurrentPublicationIds: Object.fromEntries(
      snapshot.tier2Targets.map((target) => [
        target.productKind,
        target.currentPublicationId,
      ]),
    ),
    tier2Members,
    aggregate2Members,
  };
}
