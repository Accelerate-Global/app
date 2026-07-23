import { describe, expect, it } from "vitest";

import { normalizeHeaders } from "@/lib/csv";
import {
  formImbRows,
  getImbFieldContractChecksum,
  type ImbCountryReference,
  type ImbRopReference,
} from "@/lib/imb-forming/engine";

import { createDatasetFormingLineageManifest } from "../lineage";
import type { DatasetFormingResourceBinding } from "../types";

import {
  IMB_FORMING_ENGINE,
  IMB_FORMING_ENGINE_KEY,
  IMB_PUBLICATION_TARGET_KEY,
  IMB_SOURCE_PROFILE_KEY,
  projectLegacyImbLineage,
} from "./imb";

const countries: ImbCountryReference[] = [
  {
    iso3: "USA",
    displayName: "United States",
    alternativeNames: ["United States of America"],
  },
];

const ropEntries: ImbRopReference[] = [
  {
    rop1Code: "A001",
    rop2Code: "C0001",
    rop25Code: "300001",
    rop3Code: "100001",
    status: "Active",
    joinIssue: null,
    joinIssueLabel: null,
  },
];

const resourceBindings: DatasetFormingResourceBinding[] = [
  {
    position: 0,
    key: "country-territory-codes",
    bindingType: "catalog",
    required: true,
    kind: "country-geography",
    schemaVersion: 1,
    version: "2",
    checksum: "c".repeat(64),
    resourceSetId: "resource-set-2",
    resourceSetChecksum: "d".repeat(64),
    resourceId: "country-resource",
    resourceVersionId: "country-version-2",
  },
  {
    position: 1,
    key: "rop-codes",
    bindingType: "catalog",
    required: true,
    kind: "rop-taxonomy",
    schemaVersion: 1,
    version: "1",
    checksum: "e".repeat(64),
    resourceSetId: "resource-set-2",
    resourceSetChecksum: "d".repeat(64),
    resourceId: "rop-resource",
    resourceVersionId: "rop-version-1",
  },
  {
    position: 2,
    key: "imb-field-contract",
    bindingType: "code",
    required: true,
    kind: "field-contract",
    schemaVersion: 1,
    version: "1",
    checksum: getImbFieldContractChecksum(),
    resourceSetId: null,
    resourceSetChecksum: null,
    resourceId: null,
    resourceVersionId: null,
  },
];

function fixture() {
  const source = {
    OBJECTID: "7",
    PEID: "42",
    Name: "People",
    ISOalpha3: "USA",
    Ctry: "United States of America",
    ROP3: "100001",
  };
  const columns = normalizeHeaders(Object.keys(source));
  const rows = [
    Object.fromEntries(
      columns.map((column) => [column.key, source[column.label as keyof typeof source]]),
    ),
  ];
  return { columns, rows };
}

describe("IMB dataset forming engine adapter", () => {
  it("declares stable engine, profile, target, and dependency identities", () => {
    expect(IMB_FORMING_ENGINE.engineKey).toBe(IMB_FORMING_ENGINE_KEY);
    expect(IMB_FORMING_ENGINE.sourceProfileKeys).toEqual([
      IMB_SOURCE_PROFILE_KEY,
    ]);
    expect(IMB_FORMING_ENGINE.publicationTargetKey).toBe(
      IMB_PUBLICATION_TARGET_KEY,
    );
    expect(IMB_FORMING_ENGINE.resourceRequirements.map(({ key }) => key)).toEqual([
      "country-territory-codes",
      "rop-codes",
      "source-aliases",
      "imb-field-contract",
      "imb-type-contract",
      "imb-forming-transformation",
    ]);
    expect(
      IMB_FORMING_ENGINE.resourceRequirements.filter(
        (requirement) => requirement.bindingType === "code",
      ),
    ).toEqual([
      expect.objectContaining({ contractType: "field-contract" }),
      expect.objectContaining({ contractType: "type-contract" }),
      expect.objectContaining({ contractType: "transformation-contract" }),
    ]);
  });

  it("preserves the fixed IMB v1 golden output through the shared adapter", () => {
    const { columns, rows } = fixture();
    const direct = formImbRows({
      connectionId: "connection-1",
      sourceRunId: "source-run-1",
      columns,
      rows,
      countries,
      ropEntries,
    });
    const context = {
      connectionId: "connection-1",
      sourceProfileKey: IMB_SOURCE_PROFILE_KEY,
      sourceRunId: "source-run-1",
      sourceArtifacts: {
        rowsChecksum: "a".repeat(64),
        rawChecksum: "b".repeat(64),
      },
      columns,
      rows,
      resourceBindings,
      resources: { countries, ropEntries },
    };
    const adapted = IMB_FORMING_ENGINE.form(context);

    expect(adapted.columns).toEqual(direct.columns);
    expect(adapted.rows).toEqual(direct.rows);
    expect(adapted.findings).toEqual(direct.findings);
    expect(adapted.validation).toEqual(direct.validation);
    expect(adapted.fieldContractChecksum).toBe(direct.fieldContractChecksum);
    expect(adapted.transformationChecksum).toBe(
      direct.transformationChecksum,
    );
    expect(adapted.outputChecksum).toBe(direct.outputChecksum);
    expect(adapted.outputChecksum).toBe(
      "91aa554477d10e842c709375a2468e299c69a8aace8602680ea489a518764506",
    );
    expect(adapted.valid).toBe(true);
    expect(adapted.rows).toHaveLength(1);

    const genericLineage = createDatasetFormingLineageManifest({
      context,
      engine: IMB_FORMING_ENGINE,
      result: adapted,
      inputFingerprint: "f".repeat(64),
    });
    expect(projectLegacyImbLineage(genericLineage)).toEqual({
      schemaVersion: 1,
      connectionId: "connection-1",
      sourceRunId: "source-run-1",
      sourceRowsChecksum: "a".repeat(64),
      sourceRawChecksum: "b".repeat(64),
      resourceBinding: {
        resourceSetId: "resource-set-2",
        resourceSetChecksum: "d".repeat(64),
        countryVersionId: "country-version-2",
        ropVersionId: "rop-version-1",
      },
      fieldContractVersion: 1,
      fieldContractChecksum: getImbFieldContractChecksum(),
      transformationVersion: IMB_FORMING_ENGINE.version,
      transformationChecksum: IMB_FORMING_ENGINE.checksum,
      inputRowCount: 1,
      outputRowCount: 1,
      outputChecksum:
        "91aa554477d10e842c709375a2468e299c69a8aace8602680ea489a518764506",
      columns: direct.columns,
      validation: direct.validation,
    });
  });
});
