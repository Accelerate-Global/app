import { DatasetFormingError } from "./errors";
import type {
  DatasetFormingResourceBinding,
  DatasetFormingResourceRequirement,
} from "./types";
import { isDatasetFormingChecksum } from "./types";

export type DatasetFormingCatalogResource = {
  key: string;
  kind: string;
  resourceId: string;
  versionId: string;
  version: string | number;
  schemaVersion: number;
  checksum: string | null;
  lifecycleState: string;
};

export type DatasetFormingResourceBindingIssueCode =
  | "duplicate-requirement"
  | "missing-resource-set"
  | "missing-resource"
  | "ambiguous-resource"
  | "invalid-resource"
  | "incompatible-resource-kind"
  | "incompatible-resource-schema"
  | "invalid-resource-checksum"
  | "invalid-code-contract";

export type DatasetFormingResourceBindingIssue = {
  code: DatasetFormingResourceBindingIssueCode;
  key: string;
  message: string;
  details: Record<string, unknown>;
};

export type DatasetFormingResourceBindingResolution =
  | { valid: true; bindings: DatasetFormingResourceBinding[]; issues: [] }
  | {
      valid: false;
      bindings: DatasetFormingResourceBinding[];
      issues: DatasetFormingResourceBindingIssue[];
    };

function issue(
  code: DatasetFormingResourceBindingIssueCode,
  key: string,
  message: string,
  details: Record<string, unknown> = {},
): DatasetFormingResourceBindingIssue {
  return { code, key, message, details };
}

export function resolveDatasetFormingResourceBindings(input: {
  requirements: readonly DatasetFormingResourceRequirement[];
  resourceSet: { id: string; checksum: string } | null;
  catalogResources: readonly DatasetFormingCatalogResource[];
}): DatasetFormingResourceBindingResolution {
  const bindings: DatasetFormingResourceBinding[] = [];
  const issues: DatasetFormingResourceBindingIssue[] = [];
  const seenKeys = new Set<string>();

  for (const requirement of input.requirements) {
    if (seenKeys.has(requirement.key)) {
      issues.push(
        issue(
          "duplicate-requirement",
          requirement.key,
          `Resource requirement ${requirement.key} is declared more than once.`,
        ),
      );
      continue;
    }
    seenKeys.add(requirement.key);

    if (requirement.bindingType === "code") {
      if (
        !requirement.key.trim() ||
        !requirement.contractType.trim() ||
        !requirement.version.trim() ||
        !Number.isSafeInteger(requirement.schemaVersion) ||
        requirement.schemaVersion < 1 ||
        !isDatasetFormingChecksum(requirement.checksum)
      ) {
        issues.push(
          issue(
            "invalid-code-contract",
            requirement.key,
            `Code contract ${requirement.key || "(unknown)"} has incomplete or invalid version metadata.`,
          ),
        );
        continue;
      }
      bindings.push({
        position: bindings.length,
        key: requirement.key,
        bindingType: "code",
        required: requirement.required,
        kind: requirement.contractType,
        schemaVersion: requirement.schemaVersion,
        version: requirement.version,
        checksum: requirement.checksum,
        resourceSetId: null,
        resourceSetChecksum: null,
        resourceId: null,
        resourceVersionId: null,
      });
      continue;
    }

    if (
      !input.resourceSet?.id.trim() ||
      !isDatasetFormingChecksum(input.resourceSet.checksum)
    ) {
      if (requirement.required) {
        issues.push(
          issue(
            "missing-resource-set",
            requirement.key,
            `Catalog resource ${requirement.key} cannot resolve without an immutable resource set.`,
          ),
        );
      }
      continue;
    }

    const matches = input.catalogResources.filter(
      (resource) => resource.key === requirement.key,
    );
    if (matches.length === 0) {
      if (requirement.required) {
        issues.push(
          issue(
            "missing-resource",
            requirement.key,
            `Required catalog resource ${requirement.key} is not a member of the selected set.`,
          ),
        );
      }
      continue;
    }
    if (matches.length > 1) {
      issues.push(
        issue(
          "ambiguous-resource",
          requirement.key,
          `Catalog resource ${requirement.key} resolves to more than one set member.`,
          { versionIds: matches.map((resource) => resource.versionId).sort() },
        ),
      );
      continue;
    }

    const resource = matches[0]!;
    if (
      resource.lifecycleState !== "valid" ||
      !resource.resourceId.trim() ||
      !resource.versionId.trim() ||
      !String(resource.version).trim() ||
      !Number.isSafeInteger(resource.schemaVersion) ||
      resource.schemaVersion < 1
    ) {
      issues.push(
        issue(
          "invalid-resource",
          requirement.key,
          `Catalog resource ${requirement.key} is not valid.`,
          { lifecycleState: resource.lifecycleState },
        ),
      );
      continue;
    }
    if (resource.kind !== requirement.expectedKind) {
      issues.push(
        issue(
          "incompatible-resource-kind",
          requirement.key,
          `Catalog resource ${requirement.key} has an incompatible kind.`,
          { expected: requirement.expectedKind, actual: resource.kind },
        ),
      );
      continue;
    }
    if (!requirement.compatibleSchemaVersions.includes(resource.schemaVersion)) {
      issues.push(
        issue(
          "incompatible-resource-schema",
          requirement.key,
          `Catalog resource ${requirement.key} has an incompatible schema version.`,
          {
            compatible: [...requirement.compatibleSchemaVersions],
            actual: resource.schemaVersion,
          },
        ),
      );
      continue;
    }
    if (!resource.checksum || !isDatasetFormingChecksum(resource.checksum)) {
      issues.push(
        issue(
          "invalid-resource-checksum",
          requirement.key,
          `Catalog resource ${requirement.key} has no valid deterministic checksum.`,
        ),
      );
      continue;
    }

    bindings.push({
      position: bindings.length,
      key: requirement.key,
      bindingType: "catalog",
      required: requirement.required,
      kind: resource.kind,
      schemaVersion: resource.schemaVersion,
      version: String(resource.version),
      checksum: resource.checksum,
      resourceSetId: input.resourceSet.id,
      resourceSetChecksum: input.resourceSet.checksum,
      resourceId: resource.resourceId,
      resourceVersionId: resource.versionId,
    });
  }

  if (issues.length > 0) {
    return { valid: false, bindings, issues };
  }
  return { valid: true, bindings, issues: [] };
}

export function requireDatasetFormingResourceBindings(input: {
  requirements: readonly DatasetFormingResourceRequirement[];
  resourceSet: { id: string; checksum: string } | null;
  catalogResources: readonly DatasetFormingCatalogResource[];
}) {
  const resolution = resolveDatasetFormingResourceBindings(input);
  if (!resolution.valid) {
    throw new DatasetFormingError(
      "The selected resource set does not satisfy the dataset forming engine.",
      409,
      "invalid-resource-bindings",
      { issues: resolution.issues },
    );
  }
  return resolution.bindings;
}
