import type { AxIdentityAssignmentStatus } from "./types";

export type AxIdentityExistingBinding = Readonly<{
  bindingId: string;
  pgacCode: string;
  pgicCode: string | null;
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
  generatedPgic: string | null;
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

  return {
    status: input.generatedPgic ? "reserved" : "pgac-only",
    bindingId: null,
    pgacCode: input.generatedPgac,
    pgicCode: input.generatedPgic,
    aliases: [],
    reason: input.generatedPgic
      ? "A new AX Online PGAC/PGIC binding is required."
      : "A new AX Online PGAC-only binding is required.",
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
