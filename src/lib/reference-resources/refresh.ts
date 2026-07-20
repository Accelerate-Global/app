import {
  refreshIsoCountryCodeResourceFromOfficialSource,
  type IsoCountryCodeResource,
} from "@/lib/iso-country-codes";
import { normalizeErrorForLogging } from "@/lib/error-logging";
import { refreshRopCodeResourceFromHis } from "@/lib/rop-codes";

import {
  createReferenceResourceCandidate,
  getActiveReferenceResource,
  ReferenceResourceNotFoundError,
} from "./index";
import {
  COUNTRY_RESOURCE_KEY,
  ROP_RESOURCE_KEY,
  type ReferenceResourceKey,
  type ReferenceResourcePayloadByKey,
} from "./types";

async function preserveActiveCountryAliases(resource: IsoCountryCodeResource) {
  try {
    const active = await getActiveReferenceResource(COUNTRY_RESOURCE_KEY);
    const aliases = new Map(
      active.payload.entries.map((entry) => [entry.displayName, entry.alternativeNames]),
    );
    return {
      ...resource,
      entries: resource.entries.map((entry) => ({
        ...entry,
        alternativeNames: aliases.get(entry.displayName) ?? entry.alternativeNames,
      })),
    };
  } catch (error) {
    if (error instanceof ReferenceResourceNotFoundError) return resource;
    throw error;
  }
}

async function recordSourceRefreshFailure<K extends ReferenceResourceKey>(input: {
  resourceKey: K;
  actorOwnerId: string;
  error: unknown;
}) {
  const active = await getActiveReferenceResource(input.resourceKey);
  const attemptedAt = new Date().toISOString();
  const failure = normalizeErrorForLogging(input.error);
  const payload = {
    ...active.payload,
    sourceRetrievedAt: attemptedAt,
  } as ReferenceResourcePayloadByKey[K];

  return createReferenceResourceCandidate({
    resourceKey: input.resourceKey,
    payload,
    actorOwnerId: input.actorOwnerId,
    findings: [
      {
        severity: "error",
        ruleCode: "source-refresh-failed",
        message: "The trusted source refresh failed before a complete package could be built.",
        details: {
          errorName: failure.name,
          status: failure.status ?? null,
          code: failure.code ?? null,
        },
      },
    ],
    rawManifest: {
      attemptedAt,
      outcome: "source-refresh-failed",
      errorName: failure.name,
    },
  });
}

export async function refreshReferenceResourceCandidate(input: {
  resourceKey: ReferenceResourceKey;
  actorOwnerId: string;
}) {
  if (input.resourceKey === COUNTRY_RESOURCE_KEY) {
    let payload: IsoCountryCodeResource;
    try {
      payload = await preserveActiveCountryAliases(
        await refreshIsoCountryCodeResourceFromOfficialSource(),
      );
    } catch (error) {
      return recordSourceRefreshFailure({ ...input, error });
    }
    return createReferenceResourceCandidate({
      resourceKey: COUNTRY_RESOURCE_KEY,
      payload,
      actorOwnerId: input.actorOwnerId,
    });
  }

  try {
    const payload = await refreshRopCodeResourceFromHis();
    return createReferenceResourceCandidate({
      resourceKey: ROP_RESOURCE_KEY,
      payload,
      actorOwnerId: input.actorOwnerId,
    });
  } catch (error) {
    return recordSourceRefreshFailure({ ...input, error });
  }
}
