import {
  refreshIsoCountryCodeResourceFromOfficialSource,
  type IsoCountryCodeResource,
} from "@/lib/iso-country-codes";
import { normalizeErrorForLogging } from "@/lib/error-logging";
import {
  refreshRopCodeResourceFromHis,
  type RopCodeResource,
} from "@/lib/rop-codes";

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
  type ReferenceResourceValidationFinding,
} from "./types";

function getRopRefreshFindings(
  resource: RopCodeResource,
): ReferenceResourceValidationFinding[] {
  return resource.entries.flatMap((entry) => {
    if (entry.joinIssue !== "missing-rop2") return [];

    const rop2Code = entry.rop2?.code ?? null;
    const rop25Code = entry.rop25?.code ?? null;
    return [
      {
        severity: "warning" as const,
        ruleCode: "missing-rop2-parent",
        stableEntryKey: entry.id,
        fieldName: "rop2",
        message: `ROP25 ${rop25Code ?? "Not listed"} references ROP2 ${rop2Code ?? "Not listed"}, which is absent from the HIS ROP2 layer.`,
        details: {
          rop2Code,
          rop25Code,
        },
      },
    ];
  });
}

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
      findings: getRopRefreshFindings(payload),
    });
  } catch (error) {
    return recordSourceRefreshFailure({ ...input, error });
  }
}
