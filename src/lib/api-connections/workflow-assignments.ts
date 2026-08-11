import { eq, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { apiConnections, sourceProfileBindings } from "@/db/schema";
import type {
  ApiConnectionProviderConfig,
  GoogleSheetsWorkflowAssignment,
} from "@/lib/api-types";

import {
  OnboardingWorkflowError,
  validateGoogleSheetsWorkflowAssignments,
} from "./onboarding-workflows";
import {
  ApiConnectionError,
  normalizeApiConnectionProviderConfig,
} from "./core";

type DbTransaction = Parameters<
  Parameters<ReturnType<typeof getDb>["transaction"]>[0]
>[0];

type WorkflowConnection = { id: string };

type Tier2ProfileRow = {
  profile_key: string;
  partner_key: string;
  display_name: string;
  spreadsheet_id: string;
  sheet_id: number | string;
  sheet_title: string;
  stable_row_key_column: string;
  tracking_id_column: string;
  tracking_id_source: Extract<
    GoogleSheetsWorkflowAssignment,
    { kind: "tier2" }
  >["trackingIdSource"];
  tracking_id_source_column: string | null;
  tracking_id_source_mappings: Extract<
    GoogleSheetsWorkflowAssignment,
    { kind: "tier2" }
  >["trackingIdSourceMappings"];
  source_rop3_column: string | null;
  source_country_column: string | null;
  source_iso3_column: string | null;
};

export type GoogleSheetsConnectionWorkflow = GoogleSheetsWorkflowAssignment;

export async function persistGoogleSheetsWorkflowAssignments(input: {
  tx: DbTransaction;
  workflowBySheetId: ReadonlyMap<number, GoogleSheetsWorkflowAssignment>;
  connectionBySheetId: ReadonlyMap<number, WorkflowConnection>;
  sheetTitleBySheetId: ReadonlyMap<number, string>;
  spreadsheetId: string;
  actorOwnerId: string;
}) {
  const assignments = [...input.workflowBySheetId.values()].filter(
    (assignment) => assignment.kind !== "none",
  );
  const tier1Assignments = assignments.filter(
    (assignment): assignment is Extract<
      GoogleSheetsWorkflowAssignment,
      { kind: "tier1" }
    > => assignment.kind === "tier1",
  );
  if (
    new Set(tier1Assignments.map((assignment) => assignment.sourceProfileKey))
      .size !== tier1Assignments.length
  ) {
    throw new OnboardingWorkflowError(
      "Each Tier 1 workflow can be assigned to only one selected Sheet tab.",
    );
  }

  for (const assignment of tier1Assignments) {
    const connection = input.connectionBySheetId.get(assignment.sheetId);
    if (!connection) {
      throw new OnboardingWorkflowError(
        "The Tier 1 workflow no longer matches its selected Sheet tab.",
      );
    }
    await input.tx
      .insert(sourceProfileBindings)
      .values({
        connectionId: connection.id,
        sourceProfileKey: assignment.sourceProfileKey,
        stableKeyColumn: assignment.stableKeyColumn,
        configuredByOwnerId: input.actorOwnerId,
      })
      .onConflictDoUpdate({
        target: sourceProfileBindings.connectionId,
        set: {
          sourceProfileKey: assignment.sourceProfileKey,
          stableKeyColumn: assignment.stableKeyColumn,
          configuredByOwnerId: input.actorOwnerId,
          updatedAt: new Date(),
        },
      });
    await input.tx
      .update(apiConnections)
      .set({
        datasetClassification: "PGIC",
        updatedByOwnerId: input.actorOwnerId,
        updatedAt: new Date(),
      })
      .where(eq(apiConnections.id, connection.id));
  }

  const tier2Assignments = assignments.filter(
    (assignment): assignment is Extract<
      GoogleSheetsWorkflowAssignment,
      { kind: "tier2" }
    > => assignment.kind === "tier2",
  );
  if (tier2Assignments.length === 0) return;
  if (
    new Set(tier2Assignments.map((assignment) => assignment.feedKey)).size !==
    tier2Assignments.length
  ) {
    throw new OnboardingWorkflowError(
      "Each Tier 2 engagement feed needs a unique feed name.",
    );
  }

  const contracts = (await input.tx.execute(sql<{
    version_number: number | string;
    content_checksum: string;
  }>`
    select version.version_number, version.content_checksum
    from private.tier2_contract_resources as resource
    join private.tier2_contract_resource_versions as version
      on version.id = resource.active_version_id
    where resource.resource_key = 'engagement-mappings'
      and version.lifecycle_state = 'valid'
      and version.content_checksum is not null
    limit 2
  `)) as unknown as Array<{
    version_number: number | string;
    content_checksum: string;
  }>;
  if (contracts.length !== 1) {
    throw new OnboardingWorkflowError(
      "A valid active engagement field-mapping contract is required before linking a Tier 2 workflow.",
    );
  }
  const activeOwners = (await input.tx.execute(sql<{ owner_key: string }>`
    select entry ->> 'canonicalSourceKey' as owner_key
    from private.reference_resource_sets as resource_set
    join private.reference_resource_set_members as member
      on member.set_id = resource_set.id
    join private.reference_resources as resource
      on resource.resource_key = 'source-aliases'
    join private.reference_resource_versions as version
      on version.id = member.version_id
      and version.resource_id = resource.id
    cross join lateral jsonb_array_elements(
      version.normalized_resource -> 'entries'
    ) as entry
    where resource_set.id = (
      select id from private.reference_resource_sets
      order by sequence_number desc limit 1
    )
      and version.lifecycle_state = 'valid'
      and (entry ->> 'active')::boolean
  `)) as unknown as Array<{ owner_key: string }>;
  const activeOwnerKeys = new Set(activeOwners.map((entry) => entry.owner_key));

  for (const assignment of tier2Assignments) {
    if (!activeOwnerKeys.has(assignment.ownerKey)) {
      throw new OnboardingWorkflowError(
        "Choose an active dataset owner from the source registry.",
      );
    }
    const connection = input.connectionBySheetId.get(assignment.sheetId);
    const sheetTitle = input.sheetTitleBySheetId.get(assignment.sheetId);
    if (!connection || !sheetTitle) {
      throw new OnboardingWorkflowError(
        "The Tier 2 workflow no longer matches its selected Sheet tab.",
      );
    }
    await input.tx.execute(sql`
      insert into private.tier2_partner_profiles (
        profile_key, partner_key, display_name, api_connection_id,
        spreadsheet_id, sheet_id, sheet_title, stable_row_key_column,
        tracking_id_column, tracking_id_source, tracking_id_source_column,
        tracking_id_source_mappings, source_rop3_column, source_country_column,
        source_iso3_column, contract_version,
        contract_checksum, active, created_by_owner_id, updated_by_owner_id
      ) values (
        ${assignment.feedKey}, ${assignment.ownerKey}, ${assignment.feedName},
        ${connection.id}::uuid, ${input.spreadsheetId}, ${assignment.sheetId},
        ${sheetTitle}, ${assignment.stableRowKeyColumn},
        ${assignment.trackingIdColumn}, ${assignment.trackingIdSource},
        ${assignment.trackingIdSourceColumn},
        ${JSON.stringify(assignment.trackingIdSourceMappings)}::jsonb,
        ${assignment.sourceRop3Column}, ${assignment.sourceCountryColumn},
        ${assignment.sourceIso3Column}, ${String(contracts[0]!.version_number)},
        ${contracts[0]!.content_checksum}, true, ${input.actorOwnerId},
        ${input.actorOwnerId}
      )
    `);
    await input.tx
      .update(apiConnections)
      .set({
        datasetClassification: "PGAC",
        updatedByOwnerId: input.actorOwnerId,
        updatedAt: new Date(),
      })
      .where(eq(apiConnections.id, connection.id));
  }
}

export async function getGoogleSheetsConnectionWorkflow(
  connectionId: string,
): Promise<GoogleSheetsConnectionWorkflow | null> {
  const [binding] = await getDb()
    .select()
    .from(sourceProfileBindings)
    .where(eq(sourceProfileBindings.connectionId, connectionId))
    .limit(1);
  if (binding) {
    const [connection] = await getDb()
      .select({ providerConfig: apiConnections.providerConfig })
      .from(apiConnections)
      .where(eq(apiConnections.id, connectionId))
      .limit(1);
    const config = connection
      ? normalizeApiConnectionProviderConfig(
          connection.providerConfig,
          "google_sheets",
        )
      : null;
    if (config?.provider !== "google_sheets") return null;
    return {
      sheetId: config.sheetId,
      kind: "tier1",
      sourceProfileKey: binding.sourceProfileKey,
      stableKeyColumn: binding.stableKeyColumn,
    };
  }

  const rows = (await getDb().execute(sql<Tier2ProfileRow>`
    select profile_key, partner_key, display_name, spreadsheet_id, sheet_id,
      sheet_title, stable_row_key_column, tracking_id_column,
      tracking_id_source, tracking_id_source_column,
      tracking_id_source_mappings, source_rop3_column, source_country_column,
      source_iso3_column
    from private.tier2_partner_profiles
    where api_connection_id = ${connectionId}::uuid and active
    limit 2
  `)) as unknown as Tier2ProfileRow[];
  if (rows.length > 1) {
    throw new ApiConnectionError(
      "This connection has multiple active Tier 2 profiles and needs administrator repair.",
      409,
    );
  }
  const profile = rows[0];
  return profile
    ? {
        sheetId: Number(profile.sheet_id),
        kind: "tier2",
        ownerKey: profile.partner_key,
        feedKey: profile.profile_key,
        feedName: profile.display_name,
        stableRowKeyColumn: profile.stable_row_key_column,
        trackingIdColumn: profile.tracking_id_column,
        trackingIdSource: profile.tracking_id_source,
        trackingIdSourceColumn: profile.tracking_id_source_column,
        trackingIdSourceMappings: profile.tracking_id_source_mappings,
        sourceRop3Column: profile.source_rop3_column,
        sourceCountryColumn: profile.source_country_column,
        sourceIso3Column: profile.source_iso3_column,
      }
    : null;
}

export async function assignGoogleSheetsConnectionWorkflow(input: {
  connectionId: string;
  actorOwnerId: string;
  assignment: GoogleSheetsWorkflowAssignment;
}) {
  if (input.assignment.kind === "none") {
    throw new ApiConnectionError("Choose a Tier 1 or Tier 2 workflow.", 400);
  }
  try {
    await getDb().transaction(async (tx) => {
      const locked = (await tx.execute(sql<{
        id: string;
        provider: string;
        provider_config: ApiConnectionProviderConfig;
        archived_at: Date | string | null;
      }>`
        select id, provider, provider_config, archived_at
        from private.api_connections
        where id = ${input.connectionId}::uuid
        for update
      `)) as unknown as Array<{
        id: string;
        provider: string;
        provider_config: ApiConnectionProviderConfig;
        archived_at: Date | string | null;
      }>;
      const row = locked[0];
      if (!row || row.archived_at || row.provider !== "google_sheets") {
        throw new ApiConnectionError(
          "Choose an active Google Sheets connection.",
          404,
        );
      }
      const config = normalizeApiConnectionProviderConfig(
        row.provider_config,
        row.provider,
      );
      if (config.provider !== "google_sheets") {
        throw new ApiConnectionError(
          "The Google Sheets connection configuration is invalid.",
          409,
        );
      }
      if (input.assignment.sheetId !== config.sheetId) {
        throw new ApiConnectionError(
          "The workflow does not match this connection's exact Sheet tab.",
          409,
        );
      }
      if (!config.headerSelection?.headers.length) {
        throw new ApiConnectionError(
          "Review and save the Sheet headers before linking a workflow.",
          409,
        );
      }

      const [tier1, tier2] = await Promise.all([
        tx
          .select({ connectionId: sourceProfileBindings.connectionId })
          .from(sourceProfileBindings)
          .where(eq(sourceProfileBindings.connectionId, input.connectionId))
          .limit(1),
        tx.execute(sql<{ id: string }>`
          select id from private.tier2_partner_profiles
          where api_connection_id = ${input.connectionId}::uuid and active
          limit 1
        `),
      ]);
      if (tier1.length > 0 || (tier2 as unknown as Array<{ id: string }>).length > 0) {
        throw new ApiConnectionError(
          "This connection is already linked to a data workflow.",
          409,
        );
      }

      const workflowBySheetId = validateGoogleSheetsWorkflowAssignments({
        assignments: [input.assignment],
        selectedSheetIds: [config.sheetId],
        headersBySheetId: new Map([
          [config.sheetId, config.headerSelection.headers],
        ]),
      });
      await persistGoogleSheetsWorkflowAssignments({
        tx,
        workflowBySheetId,
        connectionBySheetId: new Map([[config.sheetId, { id: row.id }]]),
        sheetTitleBySheetId: new Map([[config.sheetId, config.sheetTitle]]),
        spreadsheetId: config.spreadsheetId,
        actorOwnerId: input.actorOwnerId,
      });
    });
    return input.assignment;
  } catch (error) {
    if (error instanceof ApiConnectionError) throw error;
    if (error instanceof OnboardingWorkflowError) {
      throw new ApiConnectionError(error.message, 409);
    }
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      throw new ApiConnectionError(
        "This connection, Sheet tab, or workflow is already assigned. Refresh before trying again.",
        409,
      );
    }
    throw error;
  }
}
