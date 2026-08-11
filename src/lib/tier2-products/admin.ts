import { sql } from "drizzle-orm";

import { getDb } from "@/db";
import {
  PipelineResourceValidationError,
  preparePipelineResource,
} from "@/lib/reference-resources/pipeline-adapters";
import type {
  PipelineResourceKey,
  PipelineResourceValidationContext,
} from "@/lib/reference-resources/pipeline-types";

import { Tier2ProductError } from "./errors";
import {
  refreshTier2ProfileSheetTitle,
  validateTier2PartnerProfileConfig,
} from "./profiles";
import type {
  Tier2PartnerProfile,
  Tier2PartnerProfileConfig,
  Tier2ProductKind,
} from "./types";

export const TIER2_CONTRACT_RESOURCE_KEYS = [
  "jp-peopleid3",
  "peid",
  "engagement-mappings",
] as const satisfies readonly PipelineResourceKey[];

export type Tier2ContractResourceKey =
  (typeof TIER2_CONTRACT_RESOURCE_KEYS)[number];

type ProfileRow = {
  id: string;
  profile_key: string;
  partner_key: string;
  display_name: string;
  api_connection_id: string;
  spreadsheet_id: string;
  sheet_id: number;
  sheet_title: string;
  stable_row_key_column: string;
  tracking_id_column: string;
  tracking_id_source: Tier2PartnerProfileConfig["trackingIdSource"];
  tracking_id_source_column: string | null;
  tracking_id_source_mappings: Tier2PartnerProfileConfig["trackingIdSourceMappings"];
  source_rop3_column: string | null;
  source_country_column: string | null;
  source_iso3_column: string | null;
  contract_version: string;
  contract_checksum: string;
  active: boolean;
  created_by_owner_id: string;
  updated_by_owner_id: string;
  created_at: Date | string;
  updated_at: Date | string;
};

type ResourceRow = {
  id: string;
  resource_key: string;
  label: string;
  active_version_id: string | null;
  version_id: string | null;
  version_number: number | null;
  lifecycle_state: string | null;
  content_checksum: string | null;
  validation_summary: Record<string, unknown> | null;
  entry_count: number | null;
  source_retrieved_at: Date | string | null;
};

function iso(value: Date | string | null) {
  return value === null ? null : new Date(value).toISOString();
}

function mapProfile(row: ProfileRow): Tier2PartnerProfile {
  return {
    id: row.id,
    profileKey: row.profile_key,
    partnerKey: row.partner_key,
    displayName: row.display_name,
    apiConnectionId: row.api_connection_id,
    spreadsheetId: row.spreadsheet_id,
    sheetId: row.sheet_id,
    sheetTitle: row.sheet_title,
    stableRowKeyColumn: row.stable_row_key_column,
    trackingIdColumn: row.tracking_id_column,
    trackingIdSource: row.tracking_id_source,
    trackingIdSourceColumn: row.tracking_id_source_column,
    trackingIdSourceMappings: row.tracking_id_source_mappings,
    sourceRop3Column: row.source_rop3_column,
    sourceCountryColumn: row.source_country_column,
    sourceIso3Column: row.source_iso3_column,
    contractVersion: row.contract_version,
    contractChecksum: row.contract_checksum,
    active: row.active,
    createdByOwnerId: row.created_by_owner_id,
    updatedByOwnerId: row.updated_by_owner_id,
    createdAt: iso(row.created_at)!,
    updatedAt: iso(row.updated_at)!,
  };
}

export async function listTier2PartnerProfiles() {
  const rows = (await getDb().execute(sql<ProfileRow>`
    select * from private.tier2_partner_profiles
    order by active desc, display_name, id
  `)) as unknown as ProfileRow[];
  return rows.map(mapProfile);
}

export async function getTier2PartnerProfile(profileId: string) {
  const rows = (await getDb().execute(sql<ProfileRow>`
    select * from private.tier2_partner_profiles
    where id = ${profileId}::uuid
    limit 1
  `)) as unknown as ProfileRow[];
  return rows[0] ? mapProfile(rows[0]) : null;
}

type ProfileConnectionRow = ProfileRow & {
  connection_provider: string;
  connection_provider_config: Record<string, unknown>;
};

export async function refreshTier2PartnerProfileSheetTitleFromConnection(input: {
  profileId: string;
  connectionId: string;
}) {
  const rows = (await getDb().execute(sql<ProfileConnectionRow>`
    select profile.*, connection.provider as connection_provider,
      connection.provider_config as connection_provider_config
    from private.tier2_partner_profiles as profile
    join private.api_connections as connection
      on connection.id = profile.api_connection_id
    where profile.id = ${input.profileId}::uuid
      and connection.id = ${input.connectionId}::uuid
      and profile.active
      and connection.archived_at is null
    limit 1
  `)) as unknown as ProfileConnectionRow[];
  const row = rows[0];
  const providerConfig = row?.connection_provider_config;
  if (
    !row ||
    row.connection_provider !== "google_sheets" ||
    providerConfig?.provider !== "google_sheets" ||
    providerConfig.spreadsheetId !== row.spreadsheet_id ||
    Number(providerConfig.sheetId) !== Number(row.sheet_id)
  ) {
    throw new Tier2ProductError(
      "The Tier 2 profile no longer matches its immutable Google Sheet identity.",
      409,
      "profile-sheet-identity-stale",
    );
  }
  const liveSheetTitle =
    typeof providerConfig.sheetTitle === "string"
      ? providerConfig.sheetTitle
      : "";
  const refreshed = refreshTier2ProfileSheetTitle(
    mapProfile(row),
    liveSheetTitle,
  );
  if (refreshed.sheetTitle === row.sheet_title) return mapProfile(row);

  const updated = (await getDb().execute(sql<ProfileRow>`
    update private.tier2_partner_profiles
    set sheet_title = ${refreshed.sheetTitle}
    where id = ${row.id}::uuid
      and api_connection_id = ${input.connectionId}::uuid
      and spreadsheet_id = ${row.spreadsheet_id}
      and sheet_id = ${row.sheet_id}
    returning *
  `)) as unknown as ProfileRow[];
  if (!updated[0]) {
    throw new Tier2ProductError(
      "The Tier 2 profile changed while refreshing its Sheet display title.",
      409,
      "profile-title-refresh-race",
    );
  }
  return mapProfile(updated[0]);
}

function parseProfile(input: unknown) {
  const parsed = validateTier2PartnerProfileConfig(input);
  if (!parsed.valid) {
    throw new Tier2ProductError(
      "The Tier 2 partner profile is invalid.",
      400,
      "invalid-partner-profile",
      { issues: parsed.issues },
    );
  }
  return parsed.profile;
}

export async function createTier2PartnerProfile(input: {
  profile: unknown;
  actorOwnerId: string;
}) {
  const profile = parseProfile(input.profile);
  try {
    const rows = (await getDb().execute(sql<ProfileRow>`
      insert into private.tier2_partner_profiles (
        profile_key, partner_key, display_name, api_connection_id,
        spreadsheet_id, sheet_id, sheet_title, stable_row_key_column,
        tracking_id_column, tracking_id_source, tracking_id_source_column,
        tracking_id_source_mappings, source_rop3_column, source_country_column,
        source_iso3_column, contract_version,
        contract_checksum, active, created_by_owner_id, updated_by_owner_id
      ) values (
        ${profile.profileKey}, ${profile.partnerKey}, ${profile.displayName},
        ${profile.apiConnectionId}::uuid, ${profile.spreadsheetId}, ${profile.sheetId},
        ${profile.sheetTitle}, ${profile.stableRowKeyColumn},
        ${profile.trackingIdColumn}, ${profile.trackingIdSource},
        ${profile.trackingIdSourceColumn},
        ${JSON.stringify(profile.trackingIdSourceMappings)}::jsonb,
        ${profile.sourceRop3Column}, ${profile.sourceCountryColumn},
        ${profile.sourceIso3Column}, ${profile.contractVersion},
        ${profile.contractChecksum}, ${profile.active}, ${input.actorOwnerId},
        ${input.actorOwnerId}
      )
      returning *
    `)) as unknown as ProfileRow[];
    return mapProfile(rows[0]!);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("duplicate key") || message.includes("unique constraint")) {
      throw new Tier2ProductError(
        "That partner, profile key, or Sheet tab is already configured.",
        409,
        "duplicate-partner-profile",
      );
    }
    if (message.includes("Sheet identity")) {
      throw new Tier2ProductError(message, 409, "sheet-identity-mismatch");
    }
    throw error;
  }
}

export async function updateTier2PartnerProfile(input: {
  profileId: string;
  profile: unknown;
  actorOwnerId: string;
}) {
  const profile = parseProfile(input.profile);
  try {
    const rows = (await getDb().execute(sql<ProfileRow>`
      update private.tier2_partner_profiles
      set profile_key = ${profile.profileKey}, partner_key = ${profile.partnerKey},
        display_name = ${profile.displayName},
        api_connection_id = ${profile.apiConnectionId}::uuid,
        spreadsheet_id = ${profile.spreadsheetId}, sheet_id = ${profile.sheetId},
        sheet_title = ${profile.sheetTitle},
        stable_row_key_column = ${profile.stableRowKeyColumn},
        tracking_id_column = ${profile.trackingIdColumn},
        tracking_id_source = ${profile.trackingIdSource},
        tracking_id_source_column = ${profile.trackingIdSourceColumn},
        tracking_id_source_mappings = ${JSON.stringify(profile.trackingIdSourceMappings)}::jsonb,
        source_rop3_column = ${profile.sourceRop3Column},
        source_country_column = ${profile.sourceCountryColumn},
        source_iso3_column = ${profile.sourceIso3Column},
        contract_version = ${profile.contractVersion},
        contract_checksum = ${profile.contractChecksum}, active = ${profile.active},
        updated_by_owner_id = ${input.actorOwnerId}
      where id = ${input.profileId}::uuid
      returning *
    `)) as unknown as ProfileRow[];
    if (!rows[0]) {
      throw new Tier2ProductError("Tier 2 partner profile not found.", 404, "profile-not-found");
    }
    return mapProfile(rows[0]);
  } catch (error) {
    if (error instanceof Tier2ProductError) throw error;
    const message = error instanceof Error ? error.message : "";
    if (message.includes("stable identity fields")) {
      throw new Tier2ProductError(message, 409, "used-profile-identity-immutable");
    }
    if (message.includes("duplicate key") || message.includes("unique constraint")) {
      throw new Tier2ProductError(
        "That partner, profile key, or Sheet tab is already configured.",
        409,
        "duplicate-partner-profile",
      );
    }
    throw error;
  }
}

export async function listTier2ContractResources() {
  const rows = (await getDb().execute(sql<ResourceRow>`
    select resource.id, resource.resource_key, resource.label,
      resource.active_version_id, version.id as version_id,
      version.version_number, version.lifecycle_state, version.content_checksum,
      version.validation_summary, version.entry_count, version.source_retrieved_at
    from private.tier2_contract_resources as resource
    left join private.tier2_contract_resource_versions as version
      on version.resource_id = resource.id
    order by resource.resource_key, version.version_number desc nulls last
  `)) as unknown as ResourceRow[];
  const byResource = new Map<string, {
    id: string;
    resourceKey: string;
    label: string;
    activeVersionId: string | null;
    versions: Array<Record<string, unknown>>;
  }>();
  for (const row of rows) {
    const resource = byResource.get(row.id) ?? {
      id: row.id,
      resourceKey: row.resource_key,
      label: row.label,
      activeVersionId: row.active_version_id,
      versions: [],
    };
    if (row.version_id) {
      resource.versions.push({
        id: row.version_id,
        versionNumber: row.version_number,
        lifecycleState: row.lifecycle_state,
        contentChecksum: row.content_checksum,
        validationSummary: row.validation_summary ?? {},
        entryCount: row.entry_count ?? 0,
        sourceRetrievedAt: iso(row.source_retrieved_at),
      });
    }
    byResource.set(row.id, resource);
  }
  return [...byResource.values()];
}

async function getTier2ResourceValidationContext(): Promise<PipelineResourceValidationContext> {
  const [countries, rops] = await Promise.all([
    getDb().execute(sql<{ iso3: string }>`
      select entry.primary_alpha3 as iso3
      from private.country_reference_entries as entry
      join private.reference_resource_set_members as member
        on member.version_id = entry.version_id
      where member.set_id = (
        select id from private.reference_resource_sets
        order by sequence_number desc limit 1
      ) and entry.active and entry.primary_alpha3 is not null
    `) as unknown as Promise<Array<{ iso3: string }>>,
    getDb().execute(sql<{ rop1: string | null; rop3: string | null }>`
      select entry.rop1_code as rop1, entry.rop3_code as rop3
      from private.rop_reference_people as entry
      join private.reference_resource_set_members as member
        on member.version_id = entry.version_id
      where member.set_id = (
        select id from private.reference_resource_sets
        order by sequence_number desc limit 1
      )
    `) as unknown as Promise<Array<{ rop1: string | null; rop3: string | null }>>,
  ]);
  return {
    knownIso3Codes: new Set(countries.map((entry) => entry.iso3)),
    knownRop1Codes: new Set(rops.flatMap((entry) => entry.rop1 ? [entry.rop1] : [])),
    knownRop3Codes: new Set(rops.flatMap((entry) => entry.rop3 ? [entry.rop3] : [])),
  };
}

function withoutStableEntryKeys(
  entries: readonly Readonly<Record<string, unknown>>[],
) {
  return entries.map((entry) => Object.fromEntries(
    Object.entries(entry).filter(([key]) => key !== "stableKey"),
  ));
}

export async function createTier2ContractResourceVersion(input: {
  resourceKey: Tier2ContractResourceKey;
  payload: unknown;
  activate: boolean;
  reason: string;
  actorOwnerId: string;
  actorEmail: string | null;
}) {
  if (!input.reason.trim()) {
    throw new Tier2ProductError("A resource import reason is required.", 400, "missing-reason");
  }
  let prepared;
  try {
    prepared = preparePipelineResource(
      input.resourceKey,
      input.payload,
      await getTier2ResourceValidationContext(),
    );
  } catch (error) {
    if (error instanceof PipelineResourceValidationError) {
      throw new Tier2ProductError(
        "The Tier 2 contract resource is invalid.",
        400,
        "invalid-contract-resource",
        { findings: error.findings },
      );
    }
    throw error;
  }
  const normalizedResource = {
    schemaVersion: prepared.schemaVersion,
    resourceKey: prepared.resourceKey,
    sourceName: prepared.sourceName,
    sourceRetrievedAt: prepared.sourceRetrievedAt,
    entries: withoutStableEntryKeys(
      prepared.entries as readonly Readonly<Record<string, unknown>>[],
    ),
  };
  const version = await getDb().transaction(async (tx) => {
    await tx.execute(sql`
      select pg_advisory_xact_lock(hashtextextended('tier2-contract-resources', 0))
    `);
    const resources = (await tx.execute(sql<{ id: string }>`
      select id from private.tier2_contract_resources
      where resource_key = ${input.resourceKey}
      for update
    `)) as unknown as Array<{ id: string }>;
    if (!resources[0]) {
      throw new Tier2ProductError(
        "The Tier 2 contract resource definition is missing.",
        409,
        "contract-resource-missing",
      );
    }
    const numbers = (await tx.execute(sql<{ version_number: number }>`
      select coalesce(max(version_number), 0)::integer + 1 as version_number
      from private.tier2_contract_resource_versions
      where resource_id = ${resources[0].id}::uuid
    `)) as unknown as Array<{ version_number: number }>;
    const versions = (await tx.execute(sql<{
      id: string;
      version_number: number;
      content_checksum: string;
    }>`
      insert into private.tier2_contract_resource_versions (
        resource_id, version_number, lifecycle_state, schema_version,
        content_checksum, normalized_resource, validation_summary, entry_count,
        source_retrieved_at, created_by_owner_id, finalized_at
      ) values (
        ${resources[0].id}::uuid, ${numbers[0]!.version_number}, 'valid',
        ${prepared.schemaVersion}, ${prepared.contentChecksum},
        ${JSON.stringify(normalizedResource)}::jsonb,
        ${JSON.stringify({
          errorCount: 0,
          warningCount: prepared.findings.filter((finding) => finding.severity === "warning").length,
          findingCount: prepared.findings.length,
          findings: prepared.findings,
        })}::jsonb,
        ${prepared.entryCount}, ${prepared.sourceRetrievedAt}::timestamptz,
        ${input.actorOwnerId}, now()
      )
      returning id, version_number, content_checksum
    `)) as unknown as Array<{
      id: string;
      version_number: number;
      content_checksum: string;
    }>;
    if (input.activate) {
      await tx.execute(sql`
        select private.activate_tier2_contract_resource_version(
          ${versions[0]!.id}::uuid, ${input.actorOwnerId}, ${input.actorEmail},
          ${input.reason.trim()}, 'activate'
        )
      `);
    }
    return {
      id: versions[0]!.id,
      resourceKey: input.resourceKey,
      versionNumber: versions[0]!.version_number,
      contentChecksum: versions[0]!.content_checksum,
      entryCount: prepared.entryCount,
      activated: input.activate,
    };
  });
  return { version, resources: await listTier2ContractResources() };
}

export async function activateTier2ContractResource(input: {
  versionId: string;
  action: "activate" | "rollback";
  reason: string;
  actorOwnerId: string;
  actorEmail: string | null;
}) {
  try {
    await getDb().execute(sql`
      select private.activate_tier2_contract_resource_version(
        ${input.versionId}::uuid, ${input.actorOwnerId}, ${input.actorEmail},
        ${input.reason.trim()}, ${input.action}
      )
    `);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Resource activation failed.";
    throw new Tier2ProductError(message, 409, "resource-activation-failed");
  }
  return listTier2ContractResources();
}

export async function listTier2StableTargets() {
  const rows = (await getDb().execute(sql<{
    product_kind: Tier2ProductKind;
    publication_target_key: string;
    current_publication_id: string | null;
    version_number: number;
    update_reason: string | null;
    updated_at: Date | string | null;
  }>`
    select product_kind, publication_target_key, current_publication_id,
      version_number, update_reason, updated_at
    from private.tier2_publication_targets
    order by product_kind
  `)) as unknown as Array<{
    product_kind: Tier2ProductKind;
    publication_target_key: string;
    current_publication_id: string | null;
    version_number: number;
    update_reason: string | null;
    updated_at: Date | string | null;
  }>;
  return rows.map((row) => ({
    productKind: row.product_kind,
    publicationTargetKey: row.publication_target_key,
    currentPublicationId: row.current_publication_id,
    versionNumber: row.version_number,
    updateReason: row.update_reason,
    updatedAt: iso(row.updated_at),
  }));
}

export async function listTier2GoogleSheetConnections() {
  const rows = (await getDb().execute(sql<{
    id: string;
    name: string;
    provider_config: Record<string, unknown>;
  }>`
    select id, name, provider_config
    from private.api_connections
    where provider = 'google_sheets' and archived_at is null
    order by name, id
  `)) as unknown as Array<{
    id: string;
    name: string;
    provider_config: Record<string, unknown>;
  }>;
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    providerConfig: row.provider_config,
  }));
}
