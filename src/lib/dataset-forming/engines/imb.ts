import { IMB_API_CONNECTION_ID } from "@/lib/api-connections/providers/imb";
import {
  formImbRows,
  getImbFieldContractChecksum,
  getImbTransformationChecksum,
  type FormImbRowsResult,
  type ImbCountryReference,
  type ImbRopReference,
} from "@/lib/imb-forming/engine";
import {
  IMB_FIELD_CONTRACT_VERSION,
  IMB_FORMING_TRANSFORMATION_VERSION,
} from "@/lib/imb-forming/field-contract";
import type {
  ImbFormingLineageManifest,
  ImbFormingValidationSummary,
} from "@/lib/imb-forming/types";
import {
  COUNTRY_RESOURCE_KEY,
  ROP_RESOURCE_KEY,
} from "@/lib/reference-resources/types";
import {
  SOURCE_ALIASES_RESOURCE_KEY,
} from "@/lib/reference-resources/pipeline-types";
import { getImbTypeContractChecksum } from "@/lib/source-forming/contracts";

import type {
  DatasetFormingEngine,
  DatasetFormingLineageManifest,
} from "../types";
import { DATASET_FORMING_ARTIFACT_SCHEMA_VERSION } from "../types";

export const IMB_SOURCE_PROFILE_KEY = "imb-people-groups" as const;
export const IMB_FORMING_ENGINE_KEY = "imb" as const;
export const IMB_PUBLICATION_TARGET_KEY = "imb-people-groups" as const;

export type ImbDatasetFormingResources = {
  countries: ImbCountryReference[];
  ropEntries: ImbRopReference[];
};

export const IMB_FORMING_ENGINE = {
  engineKey: IMB_FORMING_ENGINE_KEY,
  displayName: "IMB forming",
  sourceProfileKeys: [IMB_SOURCE_PROFILE_KEY],
  version: IMB_FORMING_TRANSFORMATION_VERSION,
  checksum: getImbTransformationChecksum(),
  artifactSchemaVersion: DATASET_FORMING_ARTIFACT_SCHEMA_VERSION,
  publicationTargetKey: IMB_PUBLICATION_TARGET_KEY,
  resourceRequirements: [
    {
      bindingType: "catalog",
      key: COUNTRY_RESOURCE_KEY,
      expectedKind: "country-geography",
      compatibleSchemaVersions: [1],
      required: true,
    },
    {
      bindingType: "catalog",
      key: ROP_RESOURCE_KEY,
      expectedKind: "rop-taxonomy",
      compatibleSchemaVersions: [1],
      required: true,
    },
    {
      bindingType: "catalog",
      key: SOURCE_ALIASES_RESOURCE_KEY,
      expectedKind: "source-registry",
      compatibleSchemaVersions: [1],
      required: true,
    },
    {
      bindingType: "code",
      key: "imb-field-contract",
      contractType: "field-contract",
      schemaVersion: 1,
      version: String(IMB_FIELD_CONTRACT_VERSION),
      checksum: getImbFieldContractChecksum(),
      required: true,
    },
    {
      bindingType: "code",
      key: "imb-type-contract",
      contractType: "type-contract",
      schemaVersion: 1,
      version: String(IMB_FIELD_CONTRACT_VERSION),
      checksum: getImbTypeContractChecksum(),
      required: true,
    },
    {
      bindingType: "code",
      key: "imb-forming-transformation",
      contractType: "transformation-contract",
      schemaVersion: 1,
      version: IMB_FORMING_TRANSFORMATION_VERSION,
      checksum: getImbTransformationChecksum(),
      required: true,
    },
  ],
  form(context): FormImbRowsResult {
    return formImbRows({
      connectionId: context.connectionId,
      sourceRunId: context.sourceRunId,
      columns: context.columns,
      rows: context.rows,
      countries: context.resources.countries,
      ropEntries: context.resources.ropEntries,
    });
  },
} satisfies DatasetFormingEngine<ImbDatasetFormingResources, FormImbRowsResult>;

export function getDatasetFormingSourceProfileKey(connectionId: string) {
  return connectionId === IMB_API_CONNECTION_ID ? IMB_SOURCE_PROFILE_KEY : null;
}

export function projectLegacyImbLineage(
  lineage: DatasetFormingLineageManifest<ImbFormingValidationSummary>,
): ImbFormingLineageManifest {
  const country = lineage.resourceBindings.find(
    (binding) => binding.key === COUNTRY_RESOURCE_KEY,
  );
  const rop = lineage.resourceBindings.find(
    (binding) => binding.key === ROP_RESOURCE_KEY,
  );
  const fieldContract = lineage.resourceBindings.find(
    (binding) => binding.key === "imb-field-contract",
  );
  if (
    !country?.resourceSetId ||
    !country.resourceSetChecksum ||
    !country.resourceVersionId ||
    !rop?.resourceVersionId ||
    !fieldContract
  ) {
    throw new Error("The generic IMB lineage is missing compatibility bindings.");
  }

  return {
    schemaVersion: 1,
    connectionId: lineage.connectionId,
    sourceRunId: lineage.sourceRunId,
    sourceRowsChecksum: lineage.sourceRowsChecksum,
    sourceRawChecksum: lineage.sourceRawChecksum,
    resourceBinding: {
      resourceSetId: country.resourceSetId,
      resourceSetChecksum: country.resourceSetChecksum,
      countryVersionId: country.resourceVersionId,
      ropVersionId: rop.resourceVersionId,
    },
    fieldContractVersion: Number(fieldContract.version),
    fieldContractChecksum: fieldContract.checksum,
    transformationVersion: lineage.engineVersion,
    transformationChecksum: lineage.engineChecksum,
    inputRowCount: lineage.inputRowCount,
    outputRowCount: lineage.outputRowCount,
    outputChecksum: lineage.outputChecksum,
    columns: lineage.columns,
    validation: lineage.validation,
  };
}
