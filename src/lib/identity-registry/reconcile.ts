import type { AxIdentityAssignmentStatus } from "./types";
import { isStructurallyValidAxCode } from "./rules";

export type AxIdentityExistingBinding = Readonly<{
  bindingId: string;
  pgacCode: string;
  pgicCode: string;
  state: "reserved" | "active";
}>;

export type AxIdentityReconcileDecision = Readonly<{
  status: AxIdentityAssignmentStatus;
  bindingId: string | null;
  pgacCode: string | null;
  pgicCode: string | null;
  aliases: readonly string[];
  reason: string;
}>;

export function reconcileAxIdentity(input: {
  existing: AxIdentityExistingBinding | null;
  generatedPgac: string;
  generatedPgic: string;
  sourcePgac?: string | null;
  sourcePgic?: string | null;
  occupiedCodes: ReadonlyMap<string, string>;
}): AxIdentityReconcileDecision {
  if (input.existing) {
    return {
      status: "reused",
      bindingId: input.existing.bindingId,
      pgacCode: input.existing.pgacCode,
      pgicCode: input.existing.pgicCode,
      aliases: [],
      reason: "The stable source row already has a current AX identity binding.",
    };
  }

  const sourcePgac = input.sourcePgac?.trim() || null;
  const sourcePgic = input.sourcePgic?.trim() || null;
  const sourcePairValid =
    sourcePgac !== null &&
    sourcePgic !== null &&
    isStructurallyValidAxCode(sourcePgac, "pgac") &&
    isStructurallyValidAxCode(sourcePgic, "pgic") &&
    sourcePgic.startsWith(`${sourcePgac}-`);

  if (sourcePgac || sourcePgic) {
    if (!sourcePairValid) {
      return {
        status: "conflict",
        bindingId: null,
        pgacCode: null,
        pgicCode: null,
        aliases: [],
        reason: "The source AX code pair is malformed or inconsistent.",
      };
    }

    const occupiedBy = [sourcePgac, sourcePgic]
      .map((code) => (code ? input.occupiedCodes.get(code) : null))
      .find(Boolean);
    if (occupiedBy) {
      return {
        status: "conflict",
        bindingId: null,
        pgacCode: null,
        pgicCode: null,
        aliases: [],
        reason: `A source AX code is already bound to ${occupiedBy}.`,
      };
    }

    return {
      status: "retained",
      bindingId: null,
      pgacCode: sourcePgac,
      pgicCode: sourcePgic,
      aliases: [input.generatedPgac, input.generatedPgic].filter(
        (code) => code !== sourcePgac && code !== sourcePgic,
      ),
      reason: "The structurally valid, collision-free source codes are retained.",
    };
  }

  return {
    status: "reserved",
    bindingId: null,
    pgacCode: input.generatedPgac,
    pgicCode: input.generatedPgic,
    aliases: [],
    reason: "A new AX identity binding is required.",
  };
}

export function validateSupersession(input: {
  currentIdentityId: string;
  replacementIdentityId: string;
  replacementState: string;
}) {
  if (input.currentIdentityId === input.replacementIdentityId) {
    throw new Error("An AX identity cannot supersede itself.");
  }
  if (input.replacementState !== "active") {
    throw new Error("Only an active AX identity can become a supersession target.");
  }
}
