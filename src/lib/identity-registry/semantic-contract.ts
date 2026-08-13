import { createHash } from "node:crypto";

import { AX_IDENTITY_RULES_VERSION } from "./types";

export type AxIdentitySemanticBranch = Readonly<{
  key: string;
  condition: string;
  outcome: string;
}>;

export type AxIdentitySemanticContract = Readonly<{
  schemaVersion: 1;
  rulesVersion: typeof AX_IDENTITY_RULES_VERSION;
  normalization: Readonly<{
    text: string;
    source: string;
    rop1: string;
    rop3: string;
    iso3: string;
    allocatedSixDigit: string;
    pgac: string;
    pgic: string;
  }>;
  sourceInitials: readonly (readonly [source: string, initials: string])[];
  exactInputFingerprint: readonly string[];
  branches: readonly AxIdentitySemanticBranch[];
}>;

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)]),
    );
  }
  return value;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child);
    }
    Object.freeze(value);
  }
  return value;
}

export function canonicalizeAxIdentitySemanticContract(value: unknown) {
  return JSON.stringify(canonicalize(value));
}

export function checksumAxIdentitySemanticContract(value: unknown) {
  return createHash("sha256")
    .update(canonicalizeAxIdentitySemanticContract(value), "utf8")
    .digest("hex");
}

export const AX_IDENTITY_SEMANTIC_CONTRACT = deepFreeze({
  schemaVersion: 1,
  rulesVersion: AX_IDENTITY_RULES_VERSION,
  normalization: {
    text: "NFKC normalize, trim, and preserve case unless a component rule says otherwise",
    source:
      "lowercase; collapse underscores and whitespace to hyphens; require one built-in source or one exact pinned source-alias key and initials",
    rop1:
      "blank becomes null; otherwise uppercase one letter plus three digits; a valid ROP3 supplies its pinned ROP1 parent before formatting; PGAC uses 00 only when both ROP1 and ROP3 are absent",
    rop3:
      "blank becomes null; otherwise exactly six digits present in the pinned active ROP resource",
    iso3:
      "forming resolves current country evidence first; identity revalidates uppercase exactly three letters against the pinned active Country resource and never invents geography",
    allocatedSixDigit:
      "safe integer 0..999999 or exactly six digits, serialized as six zero-padded digits",
    pgac: "last2(ROP1)-sourceInitials-sixDigit",
    pgic: "PGAC-ISO3",
  },
  sourceInitials: [
    ["accelerate", "ax"],
    ["accelerate-owned-people-groups", "ax"],
    ["ax", "ax"],
    ["et", "et"],
    ["etno", "et"],
    ["etnopedia", "et"],
    ["etnopedia-people-groups", "et"],
    ["im", "im"],
    ["imb", "im"],
    ["imb-people-groups", "im"],
    ["jp", "jp"],
    ["joshua-project", "jp"],
    ["joshua-project-pgic", "jp"],
    ["wc", "wc"],
    ["wcd", "wc"],
    ["wcd-people-groups", "wc"],
  ],
  exactInputFingerprint: [
    "formed publication id and output checksum",
    "exact base registry revision id",
    "this semantic contract checksum",
    "Country, ROP, and optional source-alias resource version ids and checksums",
    "stable publication target key and expected-current publication id",
  ],
  branches: [
    {
      key: "stable-key-missing",
      condition: "Dataset_Row_Key is blank",
      outcome:
        "record missing-stable-row-key error and an unassignable row without reserving an identity",
    },
    {
      key: "stable-key-duplicate",
      condition: "Dataset_Row_Key repeats within the formed publication",
      outcome:
        "record duplicate-stable-row-key error and a conflicting row without reserving another identity",
    },
    {
      key: "existing-binding-reuse",
      condition:
        "the stable source row has an active binding in the exact base revision and its canonical current identity evidence is unchanged",
      outcome:
        "reuse its canonical PGAC/PGIC and binding id without allocating or reserving another value",
    },
    {
      key: "existing-binding-identity-change",
      condition:
        "ROP1, registered source initials, ROP3, or ISO3 differs from the active binding evidence",
      outcome:
        "record a blocking reviewed event with rebind, new-identity, and supported canonical-supersession actions",
    },
    {
      key: "rop3-parent-validation",
      condition:
        "the row has a valid active pinned ROP3",
      outcome:
        "replace a missing source ROP1 with the pinned ROP3 parent, reject a parentless ROP3, and preserve a source-parent discrepancy finding",
    },
    {
      key: "rop3-current-evidence-reuse",
      condition:
        "exact current ROP3 ownership already exists",
      outcome:
        "reuse its PGAC across sources and reuse or create only the requested ROP3-plus-ISO3 PGIC child",
    },
    {
      key: "rop3-current-evidence-reservation",
      condition:
        "the exact current ROP3 is unowned and its pinned ROP1 parent is valid",
      outcome:
        "reserve canonical established-format PGAC/PGIC values without consuming the allocation counter and reserve ROP3 ownership",
    },
    {
      key: "source-supplied-ax-code-inertness",
      condition: "the raw or formed row contains historical or source-supplied AX code fields",
      outcome:
        "exclude those fields from identity evidence, matching, allocation, findings, registry storage, graph checksums, and canonical output decisions",
    },
    {
      key: "pgac-only",
      condition:
        "the source classification permits PGAC and canonical ISO3 is unavailable",
      outcome:
        "assign or reuse PGAC only without fabricating geography",
    },
    {
      key: "pgic-geography-required",
      condition:
        "the source classification requires PGIC and canonical ISO3 is unavailable",
      outcome: "leave the row unassignable without consuming a registry number",
    },
    {
      key: "allocated-counter-missing-or-exhausted",
      condition:
        "a no-ROP3 allocatable row reaches a missing or exhausted people-groups counter",
      outcome:
        "record identity-namespace-exhausted and leave the row unassignable",
    },
    {
      key: "allocated-next-value-reservation",
      condition:
        "a no-ROP3 row has a stable key, satisfies its classification, has no reusable binding, and has an available counter value",
      outcome:
        "consume exactly the next non-recycling value beginning at 000001 and reserve its established-format PGAC or PGAC/PGIC binding",
    },
    {
      key: "row-rule-error",
      condition:
        "source alias, ROP1, ROP3, ISO3, code shape, collision, or allocated-value validation throws a rule error",
      outcome:
        "preserve the formed row as unassignable with one blocking finding and no canonical assignment",
    },
    {
      key: "candidate-validity",
      condition: "all rows finish reconciliation",
      outcome:
        "mark the candidate invalid when any error finding exists; otherwise mark it valid for explicit review",
    },
    {
      key: "exact-input-reuse",
      condition:
        "the same source publication and exact-input fingerprint already has a building, valid, invalid, publishing, or published attempt",
      outcome: "return that immutable attempt instead of creating duplicate effects",
    },
    {
      key: "exact-input-concurrent-reuse",
      condition:
        "concurrent builders acquire the exact publication/fingerprint advisory lock after one attempt was created",
      outcome: "return the winning reusable attempt",
    },
    {
      key: "exact-input-terminal-retry",
      condition:
        "all prior attempts for the exact publication/fingerprint are failed, expired, or rejected",
      outcome:
        "create the next positive immutable attempt number without rewriting prior attempt evidence",
    },
    {
      key: "reservation-window",
      condition: "a new candidate reserves identity authority",
      outcome:
        "set one bounded reservation expiry between one hour and thirty days, defaulting to seven days",
    },
    {
      key: "reservation-cancellation-without-recycling",
      condition: "the owning candidate is rejected, expires, or fails before activation",
      outcome:
        "cancel its reserved bindings, ROP3 evidence, codes, and identities without returning consumed values to the counter",
    },
  ],
} as const satisfies AxIdentitySemanticContract);

export const AX_IDENTITY_RULES_CHECKSUM =
  checksumAxIdentitySemanticContract(AX_IDENTITY_SEMANTIC_CONTRACT);

export const AX_IDENTITY_FORMATTER_CHECKSUM = checksumAxIdentitySemanticContract({
  pgac: AX_IDENTITY_SEMANTIC_CONTRACT.normalization.pgac,
  pgic: AX_IDENTITY_SEMANTIC_CONTRACT.normalization.pgic,
  sourceInitials: AX_IDENTITY_SEMANTIC_CONTRACT.sourceInitials,
});
