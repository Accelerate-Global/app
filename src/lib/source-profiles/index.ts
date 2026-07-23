import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { apiConnections, sourceProfileBindings } from "@/db/schema";
import { IMB_API_CONNECTION_ID } from "@/lib/api-connections/providers/imb";
import {
  ACCELERATE_SOURCE_PROFILE_KEY,
  ETNOPEDIA_SOURCE_PROFILE_KEY,
  JOSHUA_PROJECT_SOURCE_PROFILE_KEY,
  WCD_SOURCE_PROFILE_KEY,
} from "@/lib/source-forming";

import type {
  ConfigurableSourceProfileKey,
  SourceProfileBinding,
  SourceProfileSummary,
} from "./types";

export class SourceProfileBindingConflictError extends Error {
  readonly code = "source-profile-already-bound";

  constructor(readonly sourceProfileKey: ConfigurableSourceProfileKey) {
    super(
      `The ${sourceProfileKey} source profile is already assigned to another dataset connection.`,
    );
    this.name = "SourceProfileBindingConflictError";
  }
}

function hasDatabaseErrorCode(
  error: unknown,
  code: string,
  visited = new Set<object>(),
): boolean {
  if (!error || typeof error !== "object") return false;
  if (visited.has(error)) return false;
  visited.add(error);
  const candidate = error as { code?: unknown; cause?: unknown };
  return (
    candidate.code === code ||
    hasDatabaseErrorCode(candidate.cause, code, visited)
  );
}

export const ETNOPEDIA_API_CONNECTION_ID =
  "6f9f6ef2-1188-4f71-9c24-ef01debf7a02";
export const JOSHUA_PROJECT_API_CONNECTION_ID =
  "6f9f6ef2-1188-4f71-9c24-ef01debf7a03";

const codeManagedProfiles = new Map<string, SourceProfileSummary>([
  [
    IMB_API_CONNECTION_ID,
    {
      key: "imb-people-groups",
      engineKey: "imb",
      label: "IMB forming",
      stableKeyColumn: null,
      configurable: false,
    },
  ],
  [
    ETNOPEDIA_API_CONNECTION_ID,
    {
      key: ETNOPEDIA_SOURCE_PROFILE_KEY,
      engineKey: "etnopedia",
      label: "Etnopedia forming",
      stableKeyColumn: null,
      configurable: false,
    },
  ],
  [
    JOSHUA_PROJECT_API_CONNECTION_ID,
    {
      key: JOSHUA_PROJECT_SOURCE_PROFILE_KEY,
      engineKey: "joshua-project",
      label: "Joshua Project forming",
      stableKeyColumn: null,
      configurable: false,
    },
  ],
]);

const configurableProfiles: Record<
  ConfigurableSourceProfileKey,
  Omit<SourceProfileSummary, "stableKeyColumn">
> = {
  [ACCELERATE_SOURCE_PROFILE_KEY]: {
    key: ACCELERATE_SOURCE_PROFILE_KEY,
    engineKey: "accelerate",
    label: "Accelerate-owned forming",
    configurable: true,
  },
  [WCD_SOURCE_PROFILE_KEY]: {
    key: WCD_SOURCE_PROFILE_KEY,
    engineKey: "wcd",
    label: "World Christian Database forming",
    configurable: true,
  },
};

function toBinding(
  row: typeof sourceProfileBindings.$inferSelect,
): SourceProfileBinding {
  return {
    connectionId: row.connectionId,
    sourceProfileKey: row.sourceProfileKey,
    stableKeyColumn: row.stableKeyColumn,
    configuredByOwnerId: row.configuredByOwnerId,
    configuredAt: row.configuredAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function getCodeManagedSourceProfile(connectionId: string) {
  return codeManagedProfiles.get(connectionId) ?? null;
}

export async function getSourceProfileBinding(connectionId: string) {
  const [row] = await getDb()
    .select()
    .from(sourceProfileBindings)
    .where(eq(sourceProfileBindings.connectionId, connectionId))
    .limit(1);
  return row ? toBinding(row) : null;
}

export async function resolveSourceProfile(connectionId: string) {
  const codeManaged = getCodeManagedSourceProfile(connectionId);
  if (codeManaged) return codeManaged;
  const binding = await getSourceProfileBinding(connectionId);
  if (!binding) return null;
  return {
    ...configurableProfiles[binding.sourceProfileKey],
    stableKeyColumn: binding.stableKeyColumn,
  } satisfies SourceProfileSummary;
}

export async function upsertSourceProfileBinding(input: {
  connectionId: string;
  sourceProfileKey: ConfigurableSourceProfileKey;
  stableKeyColumn: string;
  actorOwnerId: string;
}) {
  const stableKeyColumn = input.stableKeyColumn.trim();
  if (!stableKeyColumn) {
    throw new Error("A durable stable-key column is required.");
  }
  const [connection] = await getDb()
    .select({
      provider: apiConnections.provider,
      archivedAt: apiConnections.archivedAt,
    })
    .from(apiConnections)
    .where(eq(apiConnections.id, input.connectionId))
    .limit(1);
  if (!connection || connection.archivedAt) {
    throw new Error("An active Google Sheets connection is required.");
  }
  if (connection.provider !== "google_sheets") {
    throw new Error("Only Google Sheets connections can use this source profile.");
  }

  try {
    const [row] = await getDb()
      .insert(sourceProfileBindings)
      .values({
        connectionId: input.connectionId,
        sourceProfileKey: input.sourceProfileKey,
        stableKeyColumn,
        configuredByOwnerId: input.actorOwnerId,
      })
      .onConflictDoUpdate({
        target: sourceProfileBindings.connectionId,
        set: {
          sourceProfileKey: input.sourceProfileKey,
          stableKeyColumn,
          configuredByOwnerId: input.actorOwnerId,
          updatedAt: new Date(),
        },
      })
      .returning();
    return toBinding(row);
  } catch (error) {
    if (hasDatabaseErrorCode(error, "23505")) {
      throw new SourceProfileBindingConflictError(input.sourceProfileKey);
    }
    throw error;
  }
}

export async function removeSourceProfileBinding(connectionId: string) {
  const [row] = await getDb()
    .delete(sourceProfileBindings)
    .where(eq(sourceProfileBindings.connectionId, connectionId))
    .returning();
  return row ? toBinding(row) : null;
}

export type {
  ConfigurableSourceProfileKey,
  SourceProfileBinding,
  SourceProfileSummary,
} from "./types";
