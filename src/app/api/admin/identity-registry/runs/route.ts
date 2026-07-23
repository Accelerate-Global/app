import { z } from "zod";

import {
  AxIdentityRegistryError,
  buildAxIdentityCandidate,
  listAxIdentityRuns,
} from "@/lib/identity-registry";
import { identityRegistryRouteError } from "@/lib/identity-registry/http";
import { jsonError } from "@/lib/http";
import { snapshotCurrentPipelineInputs } from "@/lib/pipeline-operations";
import {
  COUNTRY_RESOURCE_KEY,
  ROP_RESOURCE_KEY,
} from "@/lib/reference-resources/types";
import { withRoute } from "@/lib/route-guard";

const buildSchema = z.object({
  sourcePublicationId: z.string().uuid(),
  reservationHours: z.number().int().min(1).max(720).optional(),
});

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function requiredText(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new AxIdentityRegistryError(
      `The current ${label} is unavailable. Refresh resources before building identities.`,
      409,
    );
  }
  return value;
}

async function snapshotIdentityBuildInputs() {
  const snapshot = await snapshotCurrentPipelineInputs();
  const resources = record(snapshot.referenceVersionBindings);
  const country = record(resources[COUNTRY_RESOURCE_KEY]);
  const rop = record(resources[ROP_RESOURCE_KEY]);
  const revision = record(snapshot.registryRevision);
  return {
    countryVersionId: requiredText(country.versionId, "Country resource version"),
    countryChecksum: requiredText(country.checksum, "Country resource checksum"),
    ropVersionId: requiredText(rop.versionId, "ROP resource version"),
    ropChecksum: requiredText(rop.checksum, "ROP resource checksum"),
    baseRevisionId: requiredText(
      revision.registryRevisionId,
      "AX registry revision",
    ),
    baseRevisionChecksum: requiredText(
      revision.checksum,
      "AX registry revision checksum",
    ),
  };
}

export const GET = withRoute(
  { access: "admin", action: "view AX identity candidates" },
  async () => {
    try {
      return Response.json({ runs: await listAxIdentityRuns() });
    } catch (error) {
      return identityRegistryRouteError(
        "Failed to list AX identity candidates",
        "Could not load AX identity candidates.",
        error,
      );
    }
  },
);

export const POST = withRoute(
  { access: "admin", action: "build AX identity candidates" },
  async (identity, request: Request) => {
    const parsed = buildSchema.safeParse(await request.json());
    if (!parsed.success) return jsonError("Identity candidate payload is invalid.");
    try {
      const exactInputs = await snapshotIdentityBuildInputs();
      const run = await buildAxIdentityCandidate({
        ...parsed.data,
        ...exactInputs,
        identity,
      });
      return Response.json({ run }, { status: 201 });
    } catch (error) {
      return identityRegistryRouteError(
        "Failed to build AX identity candidate",
        "Could not build the AX identity candidate.",
        error,
      );
    }
  },
);
