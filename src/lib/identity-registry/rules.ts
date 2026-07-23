import {
  type AxIdentityCodes,
} from "./types";
import {
  AX_IDENTITY_RULES_CHECKSUM,
  AX_IDENTITY_SEMANTIC_CONTRACT,
} from "./semantic-contract";

export { AX_IDENTITY_RULES_CHECKSUM };

const SOURCE_INITIALS = new Map<string, string>(
  AX_IDENTITY_SEMANTIC_CONTRACT.sourceInitials,
);

export class AxIdentityRuleError extends Error {
  constructor(
    message: string,
    readonly ruleCode: string,
  ) {
    super(message);
    this.name = "AxIdentityRuleError";
  }
}

export type AxIdentitySourceAliasBinding = Readonly<{
  sourceKey: string;
  initials: string;
}>;

function normalizedText(value: unknown) {
  return typeof value === "string" ? value.normalize("NFKC").trim() : "";
}

export function normalizeSourceInitials(
  value: unknown,
  binding?: AxIdentitySourceAliasBinding | null,
) {
  const normalized = normalizedText(value).toLowerCase().replace(/[_\s]+/gu, "-");
  if (binding) {
    const sourceKey = normalizedText(binding.sourceKey).toLowerCase();
    const initials = normalizedText(binding.initials).toLowerCase();
    if (
      !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u.test(sourceKey) ||
      !/^[a-z0-9]{1,8}$/u.test(initials)
    ) {
      throw new AxIdentityRuleError(
        "The pinned source-alias binding is invalid.",
        "invalid-source-alias-binding",
      );
    }
    if (normalized !== sourceKey) {
      throw new AxIdentityRuleError(
        "The formed row source does not match its pinned source-alias binding.",
        "source-alias-binding-mismatch",
      );
    }
    return initials;
  }
  const initials = SOURCE_INITIALS.get(normalized);

  if (!initials) {
    throw new AxIdentityRuleError(
      "The source is not registered for AX identity generation.",
      "unknown-source-alias",
    );
  }

  return initials;
}

export function normalizeRop1(value: unknown) {
  const normalized = normalizedText(value).toUpperCase();

  if (!normalized) return null;
  if (!/^[A-Z]\d{3}$/u.test(normalized)) {
    throw new AxIdentityRuleError("ROP1 must use one letter and three digits.", "invalid-rop1");
  }

  return normalized;
}

export function normalizeRop3(value: unknown, allowedRop3?: ReadonlySet<string>) {
  const normalized = normalizedText(value);

  if (!normalized) return null;
  if (!/^\d{6}$/u.test(normalized)) {
    throw new AxIdentityRuleError("ROP3 must contain exactly six digits.", "invalid-rop3");
  }
  if (allowedRop3 && !allowedRop3.has(normalized)) {
    throw new AxIdentityRuleError(
      "ROP3 is not present in the pinned registry resource.",
      "unrecognized-rop3",
    );
  }

  return normalized;
}

export function normalizeIso3(value: unknown, allowedIso3?: ReadonlySet<string>) {
  const normalized = normalizedText(value).toUpperCase();

  if (!/^[A-Z]{3}$/u.test(normalized)) {
    throw new AxIdentityRuleError("ISO3 must contain exactly three letters.", "invalid-iso3");
  }
  if (allowedIso3 && !allowedIso3.has(normalized)) {
    throw new AxIdentityRuleError(
      "ISO3 is not present in the pinned country resource.",
      "unrecognized-iso3",
    );
  }

  return normalized;
}

export function normalizeSixDigit(value: unknown) {
  if (typeof value === "number" && Number.isSafeInteger(value)) {
    if (value < 0 || value > 999999) {
      throw new AxIdentityRuleError("The AX identity number is out of range.", "invalid-six-digit");
    }
    return value.toString().padStart(6, "0");
  }

  const normalized = normalizedText(value);
  if (!/^\d{6}$/u.test(normalized)) {
    throw new AxIdentityRuleError(
      "The AX identity component must contain exactly six digits.",
      "invalid-six-digit",
    );
  }
  return normalized;
}

export function buildAxIdentityCodes(input: {
  source: unknown;
  sourceAliasBinding?: AxIdentitySourceAliasBinding | null;
  rop1: unknown;
  sixDigit: unknown;
  iso3: unknown;
  allowedRop3?: ReadonlySet<string>;
  allowedIso3?: ReadonlySet<string>;
  sixDigitKind?: "rop3" | "allocated";
}): AxIdentityCodes {
  const sourceInitials = normalizeSourceInitials(
    input.source,
    input.sourceAliasBinding,
  );
  const rop1 = normalizeRop1(input.rop1);
  const sixDigit =
    input.sixDigitKind === "rop3"
      ? normalizeRop3(input.sixDigit, input.allowedRop3)
      : normalizeSixDigit(input.sixDigit);
  const iso3 = normalizeIso3(input.iso3, input.allowedIso3);

  if (!sixDigit) {
    throw new AxIdentityRuleError("ROP3 is required for deterministic identity.", "missing-rop3");
  }

  const pgac = `${rop1?.slice(-2) ?? "00"}-${sourceInitials}-${sixDigit}`;
  return { pgac, pgic: `${pgac}-${iso3}`, sixDigit };
}

export function isStructurallyValidAxCode(value: unknown, kind?: "pgac" | "pgic") {
  const normalized = normalizedText(value);
  const pattern =
    kind === "pgac"
      ? /^\d{2}-[a-z0-9]{1,8}-\d{6}$/u
      : kind === "pgic"
        ? /^\d{2}-[a-z0-9]{1,8}-\d{6}-[A-Z]{3}$/u
        : /^\d{2}-[a-z0-9]{1,8}-\d{6}(?:-[A-Z]{3})?$/u;
  return pattern.test(normalized);
}
