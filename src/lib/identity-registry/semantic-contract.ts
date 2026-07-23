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
      "blank becomes null; otherwise uppercase one letter plus three digits; PGAC uses the final two digits and uses 00 when absent",
    rop3:
      "blank becomes null; otherwise exactly six digits present in the pinned active ROP resource",
    iso3:
      "uppercase exactly three letters present in the pinned active Country resource",
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
        "the stable source row has an active binding in the exact base revision or a reservation owned by this run",
      outcome:
        "reuse its canonical PGAC/PGIC and binding id without allocating or reserving another value",
    },
    {
      key: "rop3-code-generation",
      condition: "the row has a valid active pinned ROP3 and valid ISO3/source inputs",
      outcome:
        "generate PGAC/PGIC from last2(ROP1)-sourceInitials-ROP3[-ISO3]",
    },
    {
      key: "rop3-source-pair-invalid",
      condition:
        "a ROP3 row supplies only one source code or supplies a malformed/internally inconsistent PGAC/PGIC pair",
      outcome: "record source-code-conflict and do not reserve an identity",
    },
    {
      key: "rop3-source-pair-collision",
      condition:
        "a structurally valid source PGAC or PGIC is already canonical or alias evidence for another identity",
      outcome: "record source-code-conflict and do not reserve an identity",
    },
    {
      key: "rop3-source-pair-retained-with-generated-aliases",
      condition:
        "a ROP3 row supplies a structurally valid, internally consistent, collision-free source code pair",
      outcome:
        "reserve the source pair as canonical and reserve any differing generated ROP3 pair as aliases",
    },
    {
      key: "rop3-generated-reservation",
      condition: "a ROP3 row supplies no source PGAC/PGIC pair",
      outcome:
        "reserve the generated ROP3 PGAC/PGIC pair as canonical without consuming the allocation counter",
    },
    {
      key: "no-rop3-source-pair-invalid",
      condition:
        "a no-ROP3 row supplies only one source code, malformed codes, or a PGIC that is not a child of its PGAC",
      outcome: "record invalid-source-code and leave the row unassignable",
    },
    {
      key: "no-rop3-source-pair-iso-mismatch",
      condition:
        "a no-ROP3 source PGIC suffix does not equal the row's normalized pinned ISO3",
      outcome: "record invalid-source-code and leave the row unassignable",
    },
    {
      key: "no-rop3-source-pair-retained",
      condition:
        "a no-ROP3 row supplies a complete structurally valid PGAC/PGIC pair whose PGIC matches the normalized ISO3",
      outcome:
        "reserve the source pair as canonical, retain its six-digit value, and advance the allocation floor beyond that value",
    },
    {
      key: "explicit-code-or-value-collision",
      condition:
        "a retained/generated canonical or alias code, or a retained allocated value, belongs to another identity",
      outcome:
        "record the corresponding rule error and leave the row unassignable without overwriting existing authority",
    },
    {
      key: "allocated-counter-missing-or-exhausted",
      condition:
        "a no-ROP3 row has no source pair and the people-groups counter is absent or beyond its maximum",
      outcome:
        "record identity-namespace-exhausted and leave the row unassignable",
    },
    {
      key: "allocated-binding-reuse",
      condition:
        "the serialized allocator finds this run's reservation or a binding visible in this run's exact base revision",
      outcome:
        "return the existing binding, canonical codes, and allocated value without consuming the counter",
    },
    {
      key: "allocated-next-value-reservation",
      condition:
        "a no-ROP3 row has no source pair, no reusable binding, and an available counter value",
      outcome:
        "consume exactly the next value and reserve its zero-padded PGAC/PGIC and stable source binding",
    },
    {
      key: "row-rule-error",
      condition:
        "source alias, ROP1, ROP3, ISO3, code shape, collision, or allocated-value validation throws a rule error",
      outcome:
        "retain the formed row as unassignable with one blocking finding and no canonical assignment",
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
        "cancel its reserved bindings/codes/identities while never returning consumed or retained values to the counter",
    },
  ],
} as const satisfies AxIdentitySemanticContract);

export const AX_IDENTITY_RULES_CHECKSUM =
  checksumAxIdentitySemanticContract(AX_IDENTITY_SEMANTIC_CONTRACT);
