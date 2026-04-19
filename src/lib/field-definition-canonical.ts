import { normalizeHeaderIdentity } from "@/lib/csv";

const FIELD_DEFINITION_CANONICAL_KEY_ALIASES = {
  frontier_group: "christianity_frontier_group",
} as const;

const FIELD_DEFINITION_ALIAS_KEYS_BY_CANONICAL_KEY = new Map<string, string[]>();

for (const [aliasKey, canonicalKey] of Object.entries(
  FIELD_DEFINITION_CANONICAL_KEY_ALIASES,
)) {
  const aliasKeys =
    FIELD_DEFINITION_ALIAS_KEYS_BY_CANONICAL_KEY.get(canonicalKey) ?? [];
  aliasKeys.push(aliasKey);
  FIELD_DEFINITION_ALIAS_KEYS_BY_CANONICAL_KEY.set(canonicalKey, aliasKeys);
}

export function resolveFieldDefinitionCanonicalKey(canonicalKey: string) {
  return (
    FIELD_DEFINITION_CANONICAL_KEY_ALIASES[
      canonicalKey as keyof typeof FIELD_DEFINITION_CANONICAL_KEY_ALIASES
    ] ?? canonicalKey
  );
}

export function getFieldDefinitionCanonicalKeyLookupKeys(canonicalKey: string) {
  const resolvedCanonicalKey = resolveFieldDefinitionCanonicalKey(canonicalKey);

  return [
    resolvedCanonicalKey,
    ...(FIELD_DEFINITION_ALIAS_KEYS_BY_CANONICAL_KEY.get(resolvedCanonicalKey) ??
      []),
  ];
}

export function getFieldDefinitionCanonicalKeyFromLabel(
  label: string,
  sourceIndex: number,
) {
  return resolveFieldDefinitionCanonicalKey(
    normalizeHeaderIdentity(label, sourceIndex),
  );
}
