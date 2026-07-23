import type { DatasetFormingEngine } from "@/lib/dataset-forming/types";
import { DATASET_FORMING_ARTIFACT_SCHEMA_VERSION } from "@/lib/dataset-forming/types";
import {
  JP_PEOPLE_ID3_RESOURCE_KEY,
  SOURCE_ALIASES_RESOURCE_KEY,
} from "@/lib/reference-resources/pipeline-types";
import {
  COUNTRY_RESOURCE_KEY,
  ROP_RESOURCE_KEY,
} from "@/lib/reference-resources/types";

import { formAccelerateRows } from "./accelerate";
import {
  ACCELERATE_SOURCE_CONTRACT,
  ACCELERATE_SOURCE_PROFILE_KEY,
  ETNOPEDIA_SOURCE_CONTRACT,
  ETNOPEDIA_SOURCE_PROFILE_KEY,
  JOSHUA_PROJECT_SOURCE_CONTRACT,
  JOSHUA_PROJECT_SOURCE_PROFILE_KEY,
  WCD_SOURCE_CONTRACT,
  WCD_SOURCE_PROFILE_KEY,
  getSourceFieldContractChecksum,
  getSourceTypeContractChecksum,
  getSourceTransformationChecksum,
} from "./contracts";
import { formEtnopediaRows } from "./etnopedia";
import { formJoshuaProjectRows } from "./joshua-project";
import type {
  SourceFormingContract,
  SourceFormingResources,
  SourceFormingResult,
} from "./types";
import { formWcdRows } from "./wcd";

function requirementsFor(
  contract: SourceFormingContract,
  options: { includeJpPeopleId3?: boolean } = {},
) {
  return [
    {
      bindingType: "catalog" as const,
      key: COUNTRY_RESOURCE_KEY,
      expectedKind: "country-geography",
      compatibleSchemaVersions: [1],
      required: true,
    },
    {
      bindingType: "catalog" as const,
      key: ROP_RESOURCE_KEY,
      expectedKind: "rop-taxonomy",
      compatibleSchemaVersions: [1],
      required: true,
    },
    ...(options.includeJpPeopleId3
      ? [{
          bindingType: "catalog" as const,
          key: JP_PEOPLE_ID3_RESOURCE_KEY,
          expectedKind: "people-crosswalk",
          compatibleSchemaVersions: [1],
          required: true,
        }]
      : []),
    {
      bindingType: "catalog" as const,
      key: SOURCE_ALIASES_RESOURCE_KEY,
      expectedKind: "source-registry",
      compatibleSchemaVersions: [1],
      required: true,
    },
    {
      bindingType: "code" as const,
      key: `${contract.key}-field-contract`,
      contractType: "field-contract",
      schemaVersion: contract.schemaVersion,
      version: contract.version,
      checksum: getSourceFieldContractChecksum(contract),
      required: true,
    },
    {
      bindingType: "code" as const,
      key: `${contract.key}-type-contract`,
      contractType: "type-contract",
      schemaVersion: contract.schemaVersion,
      version: contract.version,
      checksum: getSourceTypeContractChecksum(contract),
      required: true,
    },
    {
      bindingType: "code" as const,
      key: `${contract.key}-transformation-contract`,
      contractType: "transformation-contract",
      schemaVersion: contract.schemaVersion,
      version: contract.transformationVersion,
      checksum: getSourceTransformationChecksum(contract),
      required: true,
    },
  ];
}

export const ETNOPEDIA_FORMING_ENGINE = {
  engineKey: "etnopedia",
  displayName: "Etnopedia forming",
  sourceProfileKeys: [ETNOPEDIA_SOURCE_PROFILE_KEY],
  version: ETNOPEDIA_SOURCE_CONTRACT.transformationVersion,
  checksum: getSourceTransformationChecksum(ETNOPEDIA_SOURCE_CONTRACT),
  artifactSchemaVersion: DATASET_FORMING_ARTIFACT_SCHEMA_VERSION,
  publicationTargetKey: ETNOPEDIA_SOURCE_PROFILE_KEY,
  resourceRequirements: requirementsFor(ETNOPEDIA_SOURCE_CONTRACT),
  form(context) {
    return formEtnopediaRows({
      sourceProfileKey: context.sourceProfileKey,
      sourceRunId: context.sourceRunId,
      columns: context.columns,
      rows: context.rows,
      resources: context.resources,
    });
  },
} satisfies DatasetFormingEngine<SourceFormingResources, SourceFormingResult>;

export const JOSHUA_PROJECT_FORMING_ENGINE = {
  engineKey: "joshua-project",
  displayName: "Joshua Project forming",
  sourceProfileKeys: [JOSHUA_PROJECT_SOURCE_PROFILE_KEY],
  version: JOSHUA_PROJECT_SOURCE_CONTRACT.transformationVersion,
  checksum: getSourceTransformationChecksum(JOSHUA_PROJECT_SOURCE_CONTRACT),
  artifactSchemaVersion: DATASET_FORMING_ARTIFACT_SCHEMA_VERSION,
  publicationTargetKey: JOSHUA_PROJECT_SOURCE_PROFILE_KEY,
  resourceRequirements: requirementsFor(JOSHUA_PROJECT_SOURCE_CONTRACT, {
    includeJpPeopleId3: true,
  }),
  form(context) {
    return formJoshuaProjectRows({
      sourceProfileKey: context.sourceProfileKey,
      sourceRunId: context.sourceRunId,
      columns: context.columns,
      rows: context.rows,
      resources: context.resources,
    });
  },
} satisfies DatasetFormingEngine<SourceFormingResources, SourceFormingResult>;

export const WCD_FORMING_ENGINE = {
  engineKey: "wcd",
  displayName: "World Christian Database forming",
  sourceProfileKeys: [WCD_SOURCE_PROFILE_KEY],
  version: WCD_SOURCE_CONTRACT.transformationVersion,
  checksum: getSourceTransformationChecksum(WCD_SOURCE_CONTRACT),
  artifactSchemaVersion: DATASET_FORMING_ARTIFACT_SCHEMA_VERSION,
  publicationTargetKey: WCD_SOURCE_PROFILE_KEY,
  resourceRequirements: requirementsFor(WCD_SOURCE_CONTRACT),
  form(context) {
    return formWcdRows({
      sourceProfileKey: context.sourceProfileKey,
      sourceRunId: context.sourceRunId,
      columns: context.columns,
      rows: context.rows,
      resources: context.resources,
    });
  },
} satisfies DatasetFormingEngine<SourceFormingResources, SourceFormingResult>;

export const ACCELERATE_FORMING_ENGINE = {
  engineKey: "accelerate",
  displayName: "Accelerate-owned forming",
  sourceProfileKeys: [ACCELERATE_SOURCE_PROFILE_KEY],
  version: ACCELERATE_SOURCE_CONTRACT.transformationVersion,
  checksum: getSourceTransformationChecksum(ACCELERATE_SOURCE_CONTRACT),
  artifactSchemaVersion: DATASET_FORMING_ARTIFACT_SCHEMA_VERSION,
  publicationTargetKey: ACCELERATE_SOURCE_PROFILE_KEY,
  resourceRequirements: requirementsFor(ACCELERATE_SOURCE_CONTRACT),
  form(context) {
    return formAccelerateRows({
      sourceProfileKey: context.sourceProfileKey,
      sourceRunId: context.sourceRunId,
      columns: context.columns,
      rows: context.rows,
      resources: context.resources,
    });
  },
} satisfies DatasetFormingEngine<SourceFormingResources, SourceFormingResult>;

export const TIER1_SOURCE_FORMING_ENGINES = [
  ETNOPEDIA_FORMING_ENGINE,
  JOSHUA_PROJECT_FORMING_ENGINE,
  WCD_FORMING_ENGINE,
  ACCELERATE_FORMING_ENGINE,
] as const;
