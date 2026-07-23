import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";

import { getDb } from "@/db";
import {
  checksumApiConnectionArtifact,
  parseApiConnectionRowsArtifact,
  serializeApiConnectionRowsArtifact,
  serializeApiConnectionRowsToCsv,
} from "@/lib/api-connection-output";
import type { CurrentIdentity } from "@/lib/auth";
import {
  deleteDatasetFormingArtifacts,
  readDatasetFormingArtifact,
  uploadDatasetFormingArtifact,
} from "@/lib/dataset-forming/storage";
import {
  createDatasetStoragePath,
  getApiConnectionRunArtifactReadBuckets,
} from "@/lib/dataset-storage";
import { publishPreparedDataset } from "@/lib/datasets";
import {
  buildAxIdentityCandidate,
  publishAxIdentityCandidate,
  rejectAxIdentityCandidate,
} from "@/lib/identity-registry";
import {
  engagementMappingsResourceSchema,
  jpPeopleId3ResourceSchema,
  peidResourceSchema,
  sourceAliasResourceSchema,
} from "@/lib/reference-resources/pipeline-types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  deletePipelineDatasetBlob,
  uploadPipelineDatasetBlob,
} from "@/lib/pipeline-products/storage";
import { checksumSourceFormingValue } from "@/lib/source-forming/canonical";

import { getTier2PartnerProfile } from "./admin";
import { Tier2ProductError } from "./errors";
import { formTier2PartnerRows } from "./forming";
import { resolveTier2PartnerSourceAlias } from "./resources";
import {
  TIER2_FORMING_ENGINE_CHECKSUM,
  TIER2_FORMING_ENGINE_VERSION,
} from "./semantic-contracts";
import type {
  Tier2FormingResult,
  Tier2PartnerProfile,
  Tier2PartnerResources,
} from "./types";

export {
  TIER2_FORMING_ENGINE_CHECKSUM,
  TIER2_FORMING_ENGINE_VERSION,
} from "./semantic-contracts";
export const TIER2_FORMING_BUILD_STALE_AFTER_MINUTES = 30 as const;
export const TIER2_FORMING_PUBLICATION_LOCK_NAMESPACE = 391_743 as const;
export const TIER2_FORMING_PUBLICATION_LEASE_MS = 15 * 60 * 1_000;

export type Tier2IdentityInputSnapshot = {
  countryVersionId: string;
  countryChecksum: string;
  ropVersionId: string;
  ropChecksum: string;
  sourceAliasesVersionId: string;
  sourceAliasesChecksum: string;
  sourceAliasKey: string;
  sourceInitials: string;
  baseRegistryRevisionId: string;
  baseRegistryRevisionChecksum: string;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function createTier2IdentityInputSnapshot(
  input: Tier2IdentityInputSnapshot,
): Tier2IdentityInputSnapshot {
  const values = Object.values(input);
  if (values.some((value) => typeof value !== "string" || value.length === 0)) {
    throw new Tier2ProductError(
      "Tier 2 identity requires exact Country, ROP, and AX registry bindings.",
      409,
      "identity-input-bindings-missing",
    );
  }
  return { ...input };
}

export function readTier2IdentityInputSnapshot(
  profileSnapshot: unknown,
): Tier2IdentityInputSnapshot {
  const identityInputs = record(record(profileSnapshot).identityInputs);
  return createTier2IdentityInputSnapshot({
    countryVersionId: String(identityInputs.countryVersionId ?? ""),
    countryChecksum: String(identityInputs.countryChecksum ?? ""),
    ropVersionId: String(identityInputs.ropVersionId ?? ""),
    ropChecksum: String(identityInputs.ropChecksum ?? ""),
    sourceAliasesVersionId: String(
      identityInputs.sourceAliasesVersionId ?? "",
    ),
    sourceAliasesChecksum: String(
      identityInputs.sourceAliasesChecksum ?? "",
    ),
    sourceAliasKey: String(identityInputs.sourceAliasKey ?? ""),
    sourceInitials: String(identityInputs.sourceInitials ?? ""),
    baseRegistryRevisionId: String(identityInputs.baseRegistryRevisionId ?? ""),
    baseRegistryRevisionChecksum: String(
      identityInputs.baseRegistryRevisionChecksum ?? "",
    ),
  });
}

export function tier2FormingPublicationLockKey(publicationTargetKey: string) {
  return `tier2-forming-publication:${publicationTargetKey}`;
}

export function assertTier2FormingPublicationTargetCurrent(input: {
  expectedCurrentPublicationId: string | null;
  currentPublicationId: string | null;
}) {
  if (input.expectedCurrentPublicationId !== input.currentPublicationId) {
    throw new Tier2ProductError(
      "A newer Tier 2 formed source was published after this candidate was built. Rebuild and review the candidate again.",
      409,
      "forming-publication-target-changed",
    );
  }
}

export function tier2FormingRunLockKey(
  profileId: string,
  inputFingerprint: string,
) {
  return `tier2-forming-run:${profileId}:${inputFingerprint}`;
}

type SourceRow = {
  connection_id: string;
  run_status: string;
  rows_storage_path: string;
  rows_checksum: string | null;
  raw_checksum: string | null;
  row_count: number;
};

type FormingRunRow = {
  id: string;
  connection_id: string;
  source_run_id: string;
  source_profile_key: string;
  status: string;
  input_fingerprint: string;
  resource_set_id: string;
  input_row_count: number;
  output_row_count: number | null;
  warning_count: number;
  error_count: number;
  validation_summary: Record<string, unknown>;
  artifact_manifest: Record<string, string>;
  output_checksum: string | null;
  dataset_id: string | null;
  rejection_reason: string | null;
  publication_reason: string | null;
  error_message: string | null;
  created_at: Date | string;
  completed_at: Date | string | null;
  profile_id: string;
  profile_snapshot: unknown;
  source_publication_id: string | null;
  identity_run_id: string | null;
  publication_target_key: string;
  expected_current_publication_id: string | null;
  publication_id: string | null;
  publishing_started_at: Date | string | null;
  publication_attempt_id: string | null;
  publication_blob_path: string | null;
};

type CatalogBinding = {
  set_id: string;
  set_checksum: string;
  resource_id: string;
  resource_key:
    | "country-territory-codes"
    | "rop-codes"
    | "source-aliases";
  resource_kind: string;
  version_id: string;
  version_number: number;
  schema_version: number;
  content_checksum: string;
  normalized_resource: unknown;
};

type ContractBinding = {
  resource_id: string;
  resource_key: "jp-peopleid3" | "peid" | "engagement-mappings";
  version_id: string;
  version_number: number;
  schema_version: number;
  content_checksum: string;
  normalized_resource: unknown;
};

type RegistryRevisionBinding = {
  id: string;
  content_checksum: string;
};

export function assertTier2ProfileEngagementContract(input: {
  profile: Pick<Tier2PartnerProfile, "contractVersion" | "contractChecksum">;
  engagementBinding: Pick<
    ContractBinding,
    "version_number" | "content_checksum"
  >;
}) {
  const executedVersion = String(input.engagementBinding.version_number);
  if (
    input.profile.contractVersion !== executedVersion ||
    input.profile.contractChecksum !== input.engagementBinding.content_checksum
  ) {
    throw new Tier2ProductError(
      "The partner profile contract does not match the exact engagement-mappings version selected for this run.",
      409,
      "profile-engagement-contract-mismatch",
      {
        profileContractVersion: input.profile.contractVersion,
        profileContractChecksum: input.profile.contractChecksum,
        executedContractVersion: executedVersion,
        executedContractChecksum: input.engagementBinding.content_checksum,
      },
    );
  }
}

function iso(value: Date | string | null) {
  return value === null ? null : new Date(value).toISOString();
}

function identity(actorOwnerId: string, actorEmail: string | null): CurrentIdentity {
  return {
    ownerId: actorOwnerId,
    email: actorEmail,
    fullName: null,
    workspaceRole: "admin",
    isDatasetAdmin: true,
    mode: "supabase",
  };
}

function mapFormingRun(row: FormingRunRow) {
  return {
    id: row.id,
    profileId: row.profile_id,
    connectionId: row.connection_id,
    sourceRunId: row.source_run_id,
    sourceProfileKey: row.source_profile_key,
    status: row.status,
    inputFingerprint: row.input_fingerprint,
    resourceSetId: row.resource_set_id,
    publicationTargetKey: row.publication_target_key,
    expectedCurrentPublicationId: row.expected_current_publication_id,
    publicationId: row.publication_id,
    identityInputSnapshot: readTier2IdentityInputSnapshot(row.profile_snapshot),
    inputRowCount: row.input_row_count,
    outputRowCount: row.output_row_count,
    warningCount: row.warning_count,
    errorCount: row.error_count,
    validationSummary: row.validation_summary ?? {},
    artifactManifest: row.artifact_manifest ?? {},
    outputChecksum: row.output_checksum,
    datasetId: row.dataset_id,
    sourcePublicationId: row.source_publication_id,
    identityRunId: row.identity_run_id,
    rejectionReason: row.rejection_reason,
    publicationReason: row.publication_reason,
    errorMessage: row.error_message,
    createdAt: iso(row.created_at)!,
    completedAt: iso(row.completed_at),
    publishingStartedAt: iso(row.publishing_started_at),
    publicationAttemptId: row.publication_attempt_id,
    publicationBlobPath: row.publication_blob_path,
  };
}

async function readSourceArtifact(path: string) {
  const supabase = createSupabaseAdminClient();
  for (const bucket of getApiConnectionRunArtifactReadBuckets()) {
    const { data, error } = await supabase.storage.from(bucket).download(path);
    if (!error && data) return data.text();
    if (error?.status !== 404) throw error;
  }
  throw new Tier2ProductError("The archived partner source rows were not found.", 404, "source-artifact-missing");
}

async function loadSource(profile: Tier2PartnerProfile, sourceRunId: string) {
  const rows = (await getDb().execute(sql<SourceRow>`
    select run.connection_id, run.status as run_status,
      output.rows_storage_path, output.rows_checksum, output.raw_checksum,
      output.row_count
    from private.api_connection_runs as run
    join private.api_connection_run_outputs as output on output.run_id = run.id
    where run.id = ${sourceRunId}::uuid
      and run.connection_id = ${profile.apiConnectionId}::uuid
    limit 1
  `)) as unknown as SourceRow[];
  const source = rows[0];
  if (
    !source || source.run_status !== "success" ||
    !source.rows_checksum || !source.raw_checksum
  ) {
    throw new Tier2ProductError(
      "A successful archived ingestion run is required before Tier 2 forming.",
      409,
      "source-run-not-ready",
    );
  }
  const body = await readSourceArtifact(source.rows_storage_path);
  if (checksumApiConnectionArtifact(body) !== source.rows_checksum) {
    throw new Tier2ProductError(
      "The archived partner rows no longer match their checksum.",
      409,
      "source-checksum-mismatch",
    );
  }
  return { source, parsed: parseApiConnectionRowsArtifact(body) };
}

async function loadResources(input?: {
  resourceSetId?: string;
  contractVersionIds?: Readonly<Record<string, string>>;
}): Promise<{
  resources: Tier2PartnerResources;
  catalog: CatalogBinding[];
  contracts: ContractBinding[];
}> {
  const catalog = (await getDb().execute(sql<CatalogBinding>`
    select resource_set.id as set_id,
      resource_set.content_checksum as set_checksum,
      resource.id as resource_id, resource.resource_key,
      resource.resource_kind, version.id as version_id,
      version.version_number, version.schema_version, version.content_checksum,
      version.normalized_resource
    from private.reference_resource_sets as resource_set
    join private.reference_resource_set_members as member
      on member.set_id = resource_set.id
    join private.reference_resources as resource on resource.id = member.resource_id
    join private.reference_resource_versions as version on version.id = member.version_id
    where resource_set.id = coalesce(
      ${input?.resourceSetId ?? null}::uuid,
      (select id from private.reference_resource_sets
       order by sequence_number desc limit 1)
    ) and resource.resource_key in (
      'country-territory-codes', 'rop-codes', 'source-aliases'
    )
      and version.lifecycle_state = 'valid'
    order by resource.resource_key
  `)) as unknown as CatalogBinding[];
  if (catalog.length !== 3 || catalog.some((binding) => !binding.content_checksum)) {
    throw new Tier2ProductError(
      "The active Country/ROP/source-alias reference set is incomplete.",
      409,
      "reference-set-incomplete",
    );
  }
  const contracts = (await getDb().execute(sql<ContractBinding>`
    select resource.id as resource_id, resource.resource_key,
      version.id as version_id, version.version_number, version.schema_version,
      version.content_checksum, version.normalized_resource
    from private.tier2_contract_resources as resource
    join private.tier2_contract_resource_versions as version
      on version.resource_id = resource.id
    where resource.resource_key in ('jp-peopleid3', 'peid', 'engagement-mappings')
      and version.lifecycle_state = 'valid'
      and version.id = coalesce(
        case resource.resource_key
          when 'jp-peopleid3' then ${input?.contractVersionIds?.["jp-peopleid3"] ?? null}::uuid
          when 'peid' then ${input?.contractVersionIds?.peid ?? null}::uuid
          when 'engagement-mappings' then ${input?.contractVersionIds?.["engagement-mappings"] ?? null}::uuid
        end,
        resource.active_version_id
      )
    order by resource.resource_key
  `)) as unknown as ContractBinding[];
  if (contracts.length !== 3 || contracts.some((binding) => !binding.content_checksum)) {
    throw new Tier2ProductError(
      "All three validated Tier 2 contract resources must be active.",
      409,
      "tier2-contract-resources-incomplete",
    );
  }
  const byCatalog = new Map(catalog.map((binding) => [binding.resource_key, binding]));
  const country = byCatalog.get("country-territory-codes")!;
  const rop = byCatalog.get("rop-codes")!;
  const sourceAliases = byCatalog.get("source-aliases")!;
  const countries = (await getDb().execute(sql<{
    iso3: string;
    display_name: string;
    alternative_names: string[];
  }>`
    select primary_alpha3 as iso3, display_name, alternative_names
    from private.country_reference_entries
    where version_id = ${country.version_id}::uuid and active
      and primary_alpha3 is not null
    order by stable_key
  `)) as unknown as Array<{
    iso3: string;
    display_name: string;
    alternative_names: string[];
  }>;
  const ropEntries = (await getDb().execute(sql<{
    rop1_code: string | null;
    rop2_code: string | null;
    rop25_code: string | null;
    rop3_code: string;
    status: "Active" | "Inactive";
    join_issue: string | null;
    join_issue_label: string | null;
  }>`
    select rop1_code, rop2_code, rop25_code, rop3_code, status,
      join_issue, join_issue_label
    from private.rop_reference_people
    where version_id = ${rop.version_id}::uuid and rop3_code is not null
    order by stable_key
  `)) as unknown as Array<{
    rop1_code: string | null;
    rop2_code: string | null;
    rop25_code: string | null;
    rop3_code: string;
    status: "Active" | "Inactive";
    join_issue: string | null;
    join_issue_label: string | null;
  }>;
  const byContract = new Map(contracts.map((binding) => [binding.resource_key, binding]));
  const people = byContract.get("jp-peopleid3")!;
  const peid = byContract.get("peid")!;
  const engagement = byContract.get("engagement-mappings")!;
  const peoplePayload = jpPeopleId3ResourceSchema.safeParse(people.normalized_resource);
  const peidPayload = peidResourceSchema.safeParse(peid.normalized_resource);
  const engagementPayload = engagementMappingsResourceSchema.safeParse(engagement.normalized_resource);
  const sourceAliasesPayload = sourceAliasResourceSchema.safeParse(
    sourceAliases.normalized_resource,
  );
  if (
    !peoplePayload.success ||
    !peidPayload.success ||
    !engagementPayload.success ||
    !sourceAliasesPayload.success
  ) {
    throw new Tier2ProductError(
      "An active Tier 2 or source-alias resource does not match its typed schema.",
      409,
      "tier2-contract-resource-invalid",
    );
  }
  return {
    catalog,
    contracts,
    resources: {
      countries: countries.map((entry) => ({
        iso3: entry.iso3,
        displayName: entry.display_name,
        alternativeNames: entry.alternative_names,
      })),
      ropEntries: ropEntries.map((entry) => ({
        rop1Code: entry.rop1_code,
        rop2Code: entry.rop2_code,
        rop25Code: entry.rop25_code,
        rop3Code: entry.rop3_code,
        status: entry.status,
        joinIssue: entry.join_issue,
        joinIssueLabel: entry.join_issue_label,
      })),
      peopleId3Entries: peoplePayload.data.entries,
      peidEntries: peidPayload.data.entries,
      engagementMappings: engagementPayload.data.entries,
      sourceAliases: sourceAliasesPayload.data.entries,
      lineage: {
        countryVersionId: country.version_id,
        countryChecksum: country.content_checksum,
        ropVersionId: rop.version_id,
        ropChecksum: rop.content_checksum,
        sourceAliasesVersionId: sourceAliases.version_id,
        sourceAliasesChecksum: sourceAliases.content_checksum,
        peopleId3VersionId: people.version_id,
        peopleId3Checksum: people.content_checksum,
        peidVersionId: peid.version_id,
        peidChecksum: peid.content_checksum,
        engagementMappingsVersionId: engagement.version_id,
        engagementMappingsChecksum: engagement.content_checksum,
      },
    },
  };
}

async function loadRegistryRevision(input: {
  id: string;
  checksum: string;
}) {
  const rows = (await getDb().execute(sql<RegistryRevisionBinding>`
    select id, content_checksum
    from private.ax_registry_revisions
    where id = ${input.id}::uuid
      and content_checksum = ${input.checksum}
    limit 1
  `)) as unknown as RegistryRevisionBinding[];
  if (!rows[0]) {
    throw new Tier2ProductError(
      "The pinned AX registry revision is unavailable or no longer matches its checksum.",
      409,
      "registry-revision-binding-stale",
    );
  }
  return rows[0];
}

export async function getCurrentTier2RegistryRevisionBinding() {
  const rows = (await getDb().execute(sql<RegistryRevisionBinding>`
    select id, content_checksum
    from private.ax_registry_revisions
    order by revision_number desc
    limit 1
  `)) as unknown as RegistryRevisionBinding[];
  if (!rows[0]) {
    throw new Tier2ProductError(
      "A committed AX registry revision is required before Tier 2 forming.",
      409,
      "registry-revision-missing",
    );
  }
  return {
    id: rows[0].id,
    checksum: rows[0].content_checksum,
  };
}

async function getFormingRun(runId: string) {
  const rows = (await getDb().execute(sql<FormingRunRow>`
    select run.*, tier2.profile_id, tier2.source_publication_id,
      tier2.identity_run_id
    from private.dataset_forming_runs as run
    join private.tier2_forming_runs as tier2 on tier2.forming_run_id = run.id
    where run.id = ${runId}::uuid
    limit 1
  `)) as unknown as FormingRunRow[];
  return rows[0] ? mapFormingRun(rows[0]) : null;
}

export async function listTier2PartnerFormingRuns(limit = 100) {
  const rows = (await getDb().execute(sql<FormingRunRow>`
    select run.*, tier2.profile_id, tier2.source_publication_id,
      tier2.identity_run_id
    from private.dataset_forming_runs as run
    join private.tier2_forming_runs as tier2 on tier2.forming_run_id = run.id
    order by run.created_at desc, run.id desc
    limit ${Math.max(1, Math.min(250, limit))}
  `)) as unknown as FormingRunRow[];
  return rows.map(mapFormingRun);
}

async function persistFormingBindings(input: {
  executor: Pick<ReturnType<typeof getDb>, "execute">;
  runId: string;
  profile: Tier2PartnerProfile;
  catalog: CatalogBinding[];
  contracts: ContractBinding[];
}) {
  const set = input.catalog[0]!;
  let position = 0;
  for (const binding of input.catalog) {
    await input.executor.execute(sql`
      insert into private.dataset_forming_resource_bindings (
        forming_run_id, position, binding_key, binding_type, required, kind,
        version, checksum, schema_version, resource_set_id,
        resource_set_checksum, resource_id, resource_version_id
      ) values (
        ${input.runId}::uuid, ${position++}, ${binding.resource_key}, 'catalog',
        true, ${binding.resource_kind}, ${String(binding.version_number)},
        ${binding.content_checksum}, ${binding.schema_version},
        ${binding.set_id}::uuid, ${binding.set_checksum},
        ${binding.resource_id}::uuid, ${binding.version_id}::uuid
      )
    `);
  }
  const codeBindings = [
    {
      key: "partner-contract",
      kind: "partner-field-contract",
      version: input.profile.contractVersion,
      checksum: input.profile.contractChecksum,
      schemaVersion: 1,
    },
    ...input.contracts.map((binding) => ({
      key: binding.resource_key,
      kind: binding.resource_key,
      version: String(binding.version_number),
      checksum: binding.content_checksum,
      schemaVersion: binding.schema_version,
    })),
  ];
  for (const binding of codeBindings) {
    await input.executor.execute(sql`
      insert into private.dataset_forming_resource_bindings (
        forming_run_id, position, binding_key, binding_type, required, kind,
        version, checksum, schema_version
      ) values (
        ${input.runId}::uuid, ${position++}, ${binding.key}, 'code', true,
        ${binding.kind}, ${binding.version}, ${binding.checksum},
        ${binding.schemaVersion}
      )
    `);
  }
  for (const binding of input.catalog) {
    await input.executor.execute(sql`
      insert into private.tier2_partner_profile_resource_bindings (
        profile_id, binding_key, reference_resource_version_id,
        content_checksum, created_by_owner_id
      ) values (
        ${input.profile.id}::uuid, ${binding.resource_key},
        ${binding.version_id}::uuid, ${binding.content_checksum},
        ${input.profile.updatedByOwnerId}
      )
      on conflict (profile_id, binding_key) do update
      set reference_resource_version_id = excluded.reference_resource_version_id,
        contract_resource_version_id = null,
        content_checksum = excluded.content_checksum,
        created_by_owner_id = excluded.created_by_owner_id,
        created_at = now()
    `);
  }
  for (const binding of input.contracts) {
    await input.executor.execute(sql`
      insert into private.tier2_partner_profile_resource_bindings (
        profile_id, binding_key, contract_resource_version_id,
        content_checksum, created_by_owner_id
      ) values (
        ${input.profile.id}::uuid, ${binding.resource_key},
        ${binding.version_id}::uuid, ${binding.content_checksum},
        ${input.profile.updatedByOwnerId}
      )
      on conflict (profile_id, binding_key) do update
      set reference_resource_version_id = null,
        contract_resource_version_id = excluded.contract_resource_version_id,
        content_checksum = excluded.content_checksum,
        created_by_owner_id = excluded.created_by_owner_id,
        created_at = now()
    `);
  }
  return set;
}

export async function buildTier2PartnerFormingCandidate(input: {
  profileId: string;
  sourceRunId: string;
  actorOwnerId: string;
  actorEmail: string | null;
  resourceSetId?: string;
  contractVersionIds?: Readonly<Record<string, string>>;
  baseRegistryRevisionId: string;
  baseRegistryRevisionChecksum: string;
  expectedProfileContractChecksum?: string;
  expectedProfileUpdatedAt?: string;
}) {
  const profile = await getTier2PartnerProfile(input.profileId);
  if (!profile || !profile.active) {
    throw new Tier2ProductError("An active Tier 2 partner profile is required.", 404, "profile-not-active");
  }
  if (
    (input.expectedProfileContractChecksum &&
      profile.contractChecksum !== input.expectedProfileContractChecksum) ||
    (input.expectedProfileUpdatedAt &&
      profile.updatedAt !== input.expectedProfileUpdatedAt)
  ) {
    throw new Tier2ProductError(
      "The pinned Tier 2 partner profile changed after this run was launched.",
      409,
      "profile-input-drift",
    );
  }
  const [{ source, parsed }, loadedResources, registryRevision] = await Promise.all([
    loadSource(profile, input.sourceRunId),
    loadResources({
      resourceSetId: input.resourceSetId,
      contractVersionIds: input.contractVersionIds,
    }),
    loadRegistryRevision({
      id: input.baseRegistryRevisionId,
      checksum: input.baseRegistryRevisionChecksum,
    }),
  ]);
  const resources = loadedResources.resources;
  const resourceSetId = loadedResources.catalog[0]!.set_id;
  const engagementContract = loadedResources.contracts.find(
    (binding) => binding.resource_key === "engagement-mappings",
  );
  if (!engagementContract) {
    throw new Tier2ProductError(
      "The exact engagement-mappings contract is unavailable.",
      409,
      "engagement-contract-missing",
    );
  }
  assertTier2ProfileEngagementContract({
    profile,
    engagementBinding: engagementContract,
  });
  const sourceAlias = resolveTier2PartnerSourceAlias({
    partnerKey: profile.partnerKey,
    resources,
  });
  const identityInputSnapshot = createTier2IdentityInputSnapshot({
    countryVersionId: resources.lineage.countryVersionId,
    countryChecksum: resources.lineage.countryChecksum,
    ropVersionId: resources.lineage.ropVersionId,
    ropChecksum: resources.lineage.ropChecksum,
    sourceAliasesVersionId: resources.lineage.sourceAliasesVersionId,
    sourceAliasesChecksum: resources.lineage.sourceAliasesChecksum,
    sourceAliasKey: sourceAlias.canonicalSourceKey,
    sourceInitials: sourceAlias.initials,
    baseRegistryRevisionId: registryRevision.id,
    baseRegistryRevisionChecksum: registryRevision.content_checksum,
  });
  const publicationTargetKey = `tier2-partner-${profile.profileKey}`;
  const inputFingerprint = checksumSourceFormingValue({
    sourceRunId: input.sourceRunId,
    sourceRowsChecksum: source.rows_checksum,
    sourceRawChecksum: source.raw_checksum,
    profile,
    engineVersion: TIER2_FORMING_ENGINE_VERSION,
    engineChecksum: TIER2_FORMING_ENGINE_CHECKSUM,
    resourceSetId,
    resourceSetChecksum: loadedResources.catalog[0]!.set_checksum,
    resourceLineage: resources.lineage,
    identityInputSnapshot,
  });
  const runId = randomUUID();
  const profileChecksum = checksumSourceFormingValue(profile);
  const claimedRunId = await getDb().transaction(async (tx) => {
    await tx.execute(sql`
      select pg_advisory_xact_lock(
        hashtextextended(${tier2FormingRunLockKey(profile.id, inputFingerprint)}, 0)
      )
    `);
    await tx.execute(sql`
      select pg_advisory_xact_lock(
        hashtextextended(${`tier2-profile:${profile.id}`}, 0)
      )
    `);
    await tx.execute(sql`
      select pg_advisory_xact_lock(
        hashtextextended('tier2-contract-resources', 0)
      )
    `);
    const existing = (await tx.execute(sql<{
      id: string;
      status: string;
      stale: boolean;
    }>`
      select run.id, run.status,
        run.started_at is null or run.started_at <
          now() - (${TIER2_FORMING_BUILD_STALE_AFTER_MINUTES} * interval '1 minute')
          as stale
      from private.dataset_forming_runs as run
      join private.tier2_forming_runs as tier2 on tier2.forming_run_id = run.id
      where tier2.profile_id = ${profile.id}::uuid
        and run.input_fingerprint = ${inputFingerprint}
        and run.status not in ('failed', 'rejected')
      order by run.created_at desc
      limit 1
      for update of run
    `)) as unknown as Array<{ id: string; status: string; stale: boolean }>;
    if (existing[0] && (existing[0].status !== "building" || !existing[0].stale)) {
      return existing[0].id;
    }
    if (existing[0]) {
      await tx.execute(sql`
        update private.dataset_forming_runs
        set status = 'failed',
          error_message = 'A stale interrupted Tier 2 forming build was superseded.',
          completed_at = now()
        where id = ${existing[0].id}::uuid and status = 'building'
      `);
    }
    const currentProfiles = (await tx.execute(sql<{ id: string }>`
      select id from private.tier2_partner_profiles
      where id = ${profile.id}::uuid and active
        and updated_at = ${profile.updatedAt}::timestamptz
      for update
    `)) as unknown as { id: string }[];
    if (!currentProfiles[0]) {
      throw new Tier2ProductError(
        "The partner profile changed while the forming candidate was starting.",
        409,
        "profile-changed-during-build",
      );
    }
    for (const binding of loadedResources.contracts) {
      const exactVersions = (await tx.execute(sql<{ id: string }>`
        select id from private.tier2_contract_resource_versions
        where id = ${binding.version_id}::uuid
          and lifecycle_state = 'valid'
          and content_checksum = ${binding.content_checksum}
        for share
      `)) as unknown as { id: string }[];
      if (!exactVersions[0]) {
        throw new Tier2ProductError(
          `Pinned Tier 2 contract resource ${binding.resource_key} changed while the candidate was starting.`,
          409,
          "resource-changed-during-build",
        );
      }
    }
    const exactRevisions = (await tx.execute(sql<{ id: string }>`
      select id from private.ax_registry_revisions
      where id = ${identityInputSnapshot.baseRegistryRevisionId}::uuid
        and content_checksum = ${identityInputSnapshot.baseRegistryRevisionChecksum}
      for share
    `)) as unknown as { id: string }[];
    if (!exactRevisions[0]) {
      throw new Tier2ProductError(
        "The pinned AX registry revision changed while the candidate was starting.",
        409,
        "registry-revision-changed-during-build",
      );
    }
    const currentPublications = (await tx.execute(sql<{ id: string }>`
      select id from private.pipeline_publications
      where producer_kind = 'tier2-forming'
        and publication_target_key = ${publicationTargetKey}
      order by created_at desc, id desc
      limit 1
    `)) as unknown as { id: string }[];
    await tx.execute(sql`
      insert into private.dataset_forming_runs (
        id, connection_id, source_run_id, resource_set_id, source_profile_key,
        engine_key, artifact_schema_version, input_fingerprint,
        publication_target_key, expected_current_publication_id,
        actor_owner_id, actor_email, status,
        source_rows_checksum, source_raw_checksum, field_contract_version,
        field_contract_checksum, transformation_version,
        transformation_checksum, input_row_count, validation_summary, started_at
      ) values (
        ${runId}::uuid, ${profile.apiConnectionId}::uuid, ${input.sourceRunId}::uuid,
        ${resourceSetId}::uuid, ${profile.profileKey}, 'tier2-partner-forming', 1,
        ${inputFingerprint}, ${publicationTargetKey},
        ${currentPublications[0]?.id ?? null}::uuid,
        ${input.actorOwnerId}, ${input.actorEmail}, 'building',
        ${source.rows_checksum}, ${source.raw_checksum}, 1,
        ${profile.contractChecksum}, ${TIER2_FORMING_ENGINE_VERSION},
        ${TIER2_FORMING_ENGINE_CHECKSUM}, ${source.row_count}, '{}'::jsonb, now()
      )
    `);
    await tx.execute(sql`
      insert into private.tier2_forming_runs (
        forming_run_id, profile_id, profile_snapshot, profile_checksum
      ) values (
        ${runId}::uuid, ${profile.id}::uuid,
        ${JSON.stringify({
          profile,
          resourceLineage: resources.lineage,
          identityInputs: identityInputSnapshot,
        })}::jsonb,
        ${profileChecksum}
      )
    `);
    await persistFormingBindings({
      executor: tx,
      runId,
      profile,
      catalog: loadedResources.catalog,
      contracts: loadedResources.contracts,
    });
    return runId;
  });
  if (claimedRunId !== runId) return getFormingRun(claimedRunId);

  const uploaded: string[] = [];
  try {
    const formed = formTier2PartnerRows({
      profile,
      sourceRunId: input.sourceRunId,
      columns: parsed.columns,
      rows: parsed.rows,
      resources,
    });
    const bodies = {
      rows: serializeApiConnectionRowsArtifact({ columns: formed.columns, rows: formed.rows }),
      findings: JSON.stringify(formed.findings, null, 2),
      manifest: JSON.stringify({
        schemaVersion: 1,
        runId,
        inputFingerprint,
        profile,
        sourceRunId: input.sourceRunId,
        sourceRowsChecksum: source.rows_checksum,
        sourceRawChecksum: source.raw_checksum,
        engineVersion: TIER2_FORMING_ENGINE_VERSION,
        engineChecksum: TIER2_FORMING_ENGINE_CHECKSUM,
        resourceLineage: resources.lineage,
        identityInputs: identityInputSnapshot,
        outputChecksum: formed.outputChecksum,
      }, null, 2),
      csv: serializeApiConnectionRowsToCsv({ columns: formed.columns, rows: formed.rows }),
    };
    const manifest: Record<string, string> = {};
    for (const kind of ["rows", "findings", "manifest", "csv"] as const) {
      const path = await uploadDatasetFormingArtifact({
        engineKey: "tier2-partner-forming",
        sourceRunId: input.sourceRunId,
        formingRunId: runId,
        kind,
        body: bodies[kind],
      }, "Tier 2 forming");
      uploaded.push(path);
      manifest[kind] = path;
    }
    await getDb().transaction(async (tx) => {
      for (const finding of formed.findings) {
        await tx.execute(sql`
          insert into private.dataset_forming_findings (
            forming_run_id, severity, rule_code, source_row_index,
            stable_row_key, field_name, source_value, canonical_value,
            message, details
          ) values (
            ${runId}::uuid, ${finding.severity}, ${finding.ruleCode},
            ${finding.sourceRowIndex}, ${finding.stableRowKey},
            ${finding.fieldName}, ${finding.sourceValue}, ${finding.canonicalValue},
            ${finding.message}, ${JSON.stringify(finding.details)}::jsonb
          )
        `);
      }
      await tx.execute(sql`
        update private.dataset_forming_runs
        set status = ${formed.valid ? "valid" : "invalid"},
          output_row_count = ${formed.rows.length},
          warning_count = ${formed.validation.warningCount},
          error_count = ${formed.validation.errorCount},
          validation_summary = ${JSON.stringify(formed.validation)}::jsonb,
          artifact_manifest = ${JSON.stringify(manifest)}::jsonb,
          output_checksum = ${formed.outputChecksum},
          output_size_bytes = ${Buffer.byteLength(bodies.rows, "utf8")},
          completed_at = now()
        where id = ${runId}::uuid and status = 'building'
      `);
    });
    return getFormingRun(runId);
  } catch (error) {
    await deleteDatasetFormingArtifacts(uploaded, "Tier 2 forming").catch(() => undefined);
    await getDb().execute(sql`
      update private.dataset_forming_runs set status = 'failed',
        error_message = ${error instanceof Error ? error.message : "Tier 2 forming failed."},
        completed_at = now()
      where id = ${runId}::uuid and status = 'building'
    `);
    throw error;
  }
}

export async function recoverStaleTier2FormingPublications(input?: {
  formingRunId?: string;
  now?: Date;
}) {
  const cutoff = new Date(
    (input?.now ?? new Date()).getTime() - TIER2_FORMING_PUBLICATION_LEASE_MS,
  );
  const recovered = (await getDb().execute(sql<{
    id: string;
    publication_blob_path: string | null;
  }>`
    with stale as (
      select run.id, run.publication_blob_path
      from private.dataset_forming_runs as run
      join private.tier2_forming_runs as tier2
        on tier2.forming_run_id = run.id
      where run.status = 'publishing'
        and run.publication_id is null
        and coalesce(run.publishing_started_at, run.created_at) < ${cutoff}
        and (${input?.formingRunId ?? null}::uuid is null
          or run.id = ${input?.formingRunId ?? null}::uuid)
      order by run.publishing_started_at, run.id
      for update of run skip locked
    ), reset as (
      update private.dataset_forming_runs as run
      set status = 'valid', publication_attempt_id = null,
        publishing_started_at = null, publication_blob_path = null,
        error_message = 'A stale Tier 2 formed-source publication lease was recovered.'
      from stale
      where run.id = stale.id
      returning run.id, stale.publication_blob_path
    )
    select id, publication_blob_path from reset
  `)) as unknown as Array<{
    id: string;
    publication_blob_path: string | null;
  }>;
  await Promise.all(recovered.flatMap((row) =>
    row.publication_blob_path
      ? [deletePipelineDatasetBlob(row.publication_blob_path).catch(() => undefined)]
      : []
  ));
  return recovered.length;
}

export async function publishTier2PartnerFormingCandidate(input: {
  formingRunId: string;
  reason: string;
  acknowledgeWarnings: boolean;
  actorOwnerId: string;
  actorEmail: string | null;
}) {
  await recoverStaleTier2FormingPublications();
  const run = await getFormingRun(input.formingRunId);
  if (!run) throw new Tier2ProductError("Tier 2 forming candidate not found.", 404, "forming-run-not-found");
  if (run.sourcePublicationId) {
    return { formingRun: run, sourcePublicationId: run.sourcePublicationId };
  }
  if (run.status !== "valid" || run.errorCount !== 0 || !run.outputChecksum) {
    throw new Tier2ProductError("Only a valid error-free partner candidate can publish.", 409, "forming-not-publishable");
  }
  if (run.warningCount > 0 && !input.acknowledgeWarnings) {
    throw new Tier2ProductError("Acknowledge forming warnings before publication.", 409, "warnings-not-acknowledged");
  }
  if (!input.reason.trim()) throw new Tier2ProductError("A publication reason is required.", 400, "missing-reason");
  const rowsPath = run.artifactManifest.rows;
  const csvPath = run.artifactManifest.csv;
  if (!rowsPath || !csvPath) throw new Tier2ProductError("Forming artifacts are incomplete.", 409, "missing-artifact");
  const [rowsBody, csv] = await Promise.all([
    readDatasetFormingArtifact(rowsPath, "Tier 2 forming"),
    readDatasetFormingArtifact(csvPath, "Tier 2 forming"),
  ]);
  const parsed = parseApiConnectionRowsArtifact(rowsBody);
  if (
    parsed.rows.length !== run.outputRowCount ||
    checksumSourceFormingValue({ columns: parsed.columns, rows: parsed.rows }) !== run.outputChecksum ||
    serializeApiConnectionRowsToCsv(parsed) !== csv
  ) {
    throw new Tier2ProductError("The forming artifact no longer matches its reviewed checksum.", 409, "artifact-checksum-mismatch");
  }
  const expectedTarget = run.expectedCurrentPublicationId
    ? (await getDb().execute(sql<{ dataset_id: string }>`
        select dataset_id from private.pipeline_publications
        where id = ${run.expectedCurrentPublicationId}::uuid
          and producer_kind = 'tier2-forming'
          and publication_target_key = ${run.publicationTargetKey}
        limit 1
      `)) as unknown as { dataset_id: string }[]
    : [];
  if (run.expectedCurrentPublicationId && !expectedTarget[0]) {
    throw new Tier2ProductError(
      "The Tier 2 formed-source target captured by this candidate is unavailable.",
      409,
      "forming-publication-target-missing",
    );
  }
  const fileName = `${run.sourceProfileKey}-formed.csv`;
  const publicationAttemptId = randomUUID();
  const blobPath = createDatasetStoragePath(fileName);
  let blobCommitted = false;
  let publicationClaimed = false;
  try {
    let claims: { id: string }[];
    try {
      claims = (await getDb().execute(sql<{ id: string }>`
        update private.dataset_forming_runs as forming_run
        set status = 'publishing', publishing_started_at = now(),
          publication_attempt_id = ${publicationAttemptId}::uuid,
          publication_blob_path = ${blobPath},
          error_message = null
        where forming_run.id = ${run.id}::uuid and forming_run.status = 'valid'
          and forming_run.expected_current_publication_id is not distinct from (
            select publication.id
            from private.pipeline_publications as publication
            where publication.producer_kind = 'tier2-forming'
              and publication.publication_target_key = forming_run.publication_target_key
            order by publication.created_at desc, publication.id desc
            limit 1
          )
        returning forming_run.id
      `)) as unknown as { id: string }[];
    } catch (error) {
      if (typeof error === "object" && error && "code" in error && error.code === "23505") {
        throw new Tier2ProductError(
          "Another candidate for this Tier 2 formed-source target is being published.",
          409,
          "forming-publication-in-progress",
        );
      }
      throw error;
    }
    if (!claims[0]) {
      throw new Tier2ProductError(
        "The Tier 2 forming candidate changed before publication could start.",
        409,
        "forming-publication-claim-lost",
      );
    }
    publicationClaimed = true;
    await uploadPipelineDatasetBlob({ fileName, csv, storagePath: blobPath });
    let sourcePublicationId: string | null = null;
    const result = await publishPreparedDataset({
      targetDatasetId: expectedTarget[0]?.dataset_id ?? null,
      actorOwnerId: input.actorOwnerId,
      actorEmail: input.actorEmail,
      fileName,
      blobPath,
      sizeBytes: Buffer.byteLength(csv, "utf8"),
      columns: parsed.columns,
      rows: parsed.rows,
      classification: "PGIC",
      isWorkspaceVisible: false,
      finalize: async ({ executor, datasetId }) => {
        await executor.execute(sql`
          select private.lock_tier2_forming_publication_target(
            ${run.id}::uuid, ${publicationAttemptId}::uuid
          )
        `);
        const publications = (await executor.execute(sql<{ id: string }>`
          insert into private.pipeline_publications (
            producer_kind, producer_run_id, dataset_id, source_profile_key,
            registry_revision_id, output_checksum, row_count, artifact_manifest,
            actor_owner_id, actor_email, reason, publication_target_key,
            producer_definition_key
          ) values (
            'tier2-forming', ${run.id}::uuid, ${datasetId}::uuid,
            ${run.sourceProfileKey}, null, ${run.outputChecksum}, ${parsed.rows.length},
            ${JSON.stringify(run.artifactManifest)}::jsonb, ${input.actorOwnerId},
            ${input.actorEmail}, ${input.reason.trim()},
            ${run.publicationTargetKey}, 'tier2-partner-forming'
          ) returning id
        `)) as unknown as { id: string }[];
        sourcePublicationId = publications[0]!.id;
        const batchSize = 2_000;
        for (let offset = 0; offset < parsed.rows.length; offset += batchSize) {
          const batch = parsed.rows.slice(offset, offset + batchSize);
          await executor.execute(sql`
            insert into private.pipeline_publication_rows (publication_id, row_index, data)
            select ${sourcePublicationId}::uuid,
              (${offset} + ordinal - 1)::integer, value
            from jsonb_array_elements(${JSON.stringify(batch)}::jsonb)
              with ordinality as entry(value, ordinal)
          `);
        }
        const committedRuns = (await executor.execute(sql<{ id: string }>`
          update private.dataset_forming_runs
          set status = 'published', dataset_id = ${datasetId}::uuid,
            publication_id = ${sourcePublicationId}::uuid,
            publication_reason = ${input.reason.trim()},
            warnings_acknowledged = ${input.acknowledgeWarnings},
            published_by_owner_id = ${input.actorOwnerId}, published_at = now(),
            publishing_started_at = null, publication_attempt_id = null,
            publication_blob_path = ${blobPath}
          where id = ${run.id}::uuid and status = 'publishing'
            and publication_attempt_id = ${publicationAttemptId}::uuid
          returning id
        `)) as unknown as { id: string }[];
        if (!committedRuns[0]) {
          throw new Tier2ProductError(
            "This Tier 2 formed-source publication attempt lost its lease before commit.",
            409,
            "forming-publication-lease-lost",
          );
        }
        await executor.execute(sql`
          update private.tier2_forming_runs
          set source_publication_id = ${sourcePublicationId}::uuid
          where forming_run_id = ${run.id}::uuid and source_publication_id is null
        `);
      },
    });
    if (!result || !sourcePublicationId) {
      throw new Tier2ProductError("The partner publication target disappeared.", 409, "publication-target-missing");
    }
    blobCommitted = true;
    return {
      formingRun: await getFormingRun(run.id),
      sourcePublicationId: sourcePublicationId as string,
    };
  } catch (error) {
    if (!blobCommitted && publicationClaimed) {
      await deletePipelineDatasetBlob(blobPath).catch(() => undefined);
    }
    if (publicationClaimed) {
      await getDb().execute(sql`
        update private.dataset_forming_runs
        set status = 'valid', publishing_started_at = null,
          publication_attempt_id = null, publication_blob_path = null,
          error_message = ${error instanceof Error ? error.message : "Tier 2 forming publication failed."}
        where id = ${run.id}::uuid and status = 'publishing'
          and publication_attempt_id = ${publicationAttemptId}::uuid
          and publication_id is null
      `).catch(() => undefined);
    }
    throw error;
  }
}

export async function rejectTier2PartnerFormingCandidate(input: {
  formingRunId: string;
  reason: string;
  actorOwnerId: string;
}) {
  if (!input.reason.trim()) throw new Tier2ProductError("A rejection reason is required.", 400, "missing-reason");
  const rows = (await getDb().execute(sql<{ id: string }>`
    update private.dataset_forming_runs as run
    set status = 'rejected', rejection_reason = ${input.reason.trim()},
      rejected_by_owner_id = ${input.actorOwnerId}, rejected_at = now()
    from private.tier2_forming_runs as tier2
    where run.id = ${input.formingRunId}::uuid
      and tier2.forming_run_id = run.id and run.status in ('valid', 'invalid')
    returning run.id
  `)) as unknown as { id: string }[];
  if (!rows[0]) throw new Tier2ProductError("Only a reviewable forming candidate can be rejected.", 409, "forming-not-reviewable");
  return getFormingRun(rows[0].id);
}

export async function downloadTier2PartnerFormingArtifact(
  formingRunId: string,
  kind: "rows" | "findings" | "manifest" | "csv",
) {
  const run = await getFormingRun(formingRunId);
  const path = run?.artifactManifest[kind];
  if (!run) throw new Tier2ProductError("Tier 2 forming candidate not found.", 404, "forming-run-not-found");
  if (!path) throw new Tier2ProductError(`The ${kind} artifact is missing.`, 409, "missing-artifact");
  return {
    body: await readDatasetFormingArtifact(path, "Tier 2 forming"),
    contentType: kind === "csv" ? "text/csv; charset=utf-8" : "application/json; charset=utf-8",
    fileName: `${run.sourceProfileKey}-${run.id}-${kind}.${kind === "csv" ? "csv" : "json"}`,
  };
}

export async function buildTier2PartnerIdentityCandidate(input: {
  formingRunId: string;
  sourcePublicationId?: string;
  actorOwnerId: string;
  actorEmail: string | null;
}) {
  const run = await getFormingRun(input.formingRunId);
  const sourcePublicationId = run?.sourcePublicationId ?? null;
  if (
    input.sourcePublicationId &&
    sourcePublicationId &&
    input.sourcePublicationId !== sourcePublicationId
  ) {
    throw new Tier2ProductError(
      "The supplied forming publication does not belong to the pinned Tier 2 candidate.",
      409,
      "forming-publication-mismatch",
    );
  }
  if (!run || !sourcePublicationId) {
    throw new Tier2ProductError(
      "Publish the exact Tier 2 forming candidate before identity reconciliation.",
      409,
      "forming-publication-required",
    );
  }
  const candidate = await buildAxIdentityCandidate({
    sourcePublicationId,
    identity: identity(input.actorOwnerId, input.actorEmail),
    countryVersionId: run.identityInputSnapshot.countryVersionId,
    countryChecksum: run.identityInputSnapshot.countryChecksum,
    ropVersionId: run.identityInputSnapshot.ropVersionId,
    ropChecksum: run.identityInputSnapshot.ropChecksum,
    sourceAliasesVersionId:
      run.identityInputSnapshot.sourceAliasesVersionId,
    sourceAliasesChecksum: run.identityInputSnapshot.sourceAliasesChecksum,
    sourceAliasKey: run.identityInputSnapshot.sourceAliasKey,
    sourceInitials: run.identityInputSnapshot.sourceInitials,
    baseRevisionId: run.identityInputSnapshot.baseRegistryRevisionId,
    baseRevisionChecksum:
      run.identityInputSnapshot.baseRegistryRevisionChecksum,
  });
  if (candidate) {
    await getDb().execute(sql`
      update private.tier2_forming_runs set identity_run_id = ${candidate.id}::uuid
      where forming_run_id = ${input.formingRunId}::uuid and identity_run_id is null
    `);
  }
  return candidate;
}

export async function publishTier2PartnerIdentityCandidate(input: {
  identityRunId: string;
  reason: string;
  actorOwnerId: string;
  actorEmail: string | null;
}) {
  return publishAxIdentityCandidate({
    runId: input.identityRunId,
    reason: input.reason,
    identity: identity(input.actorOwnerId, input.actorEmail),
  });
}

export async function rejectTier2PartnerIdentityCandidate(input: {
  identityRunId: string;
  reason: string;
  actorOwnerId: string;
  actorEmail: string | null;
}) {
  return rejectAxIdentityCandidate({
    runId: input.identityRunId,
    reason: input.reason,
    identity: identity(input.actorOwnerId, input.actorEmail),
  });
}

export function summarizeTier2FormingResult(result: Tier2FormingResult) {
  return {
    valid: result.valid,
    rowCount: result.rows.length,
    warningCount: result.validation.warningCount,
    errorCount: result.validation.errorCount,
    outputChecksum: result.outputChecksum,
  };
}
