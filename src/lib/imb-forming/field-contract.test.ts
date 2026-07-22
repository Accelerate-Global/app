import { describe, expect, it } from "vitest";

import {
  IMB_FIELD_CONTRACT,
  IMB_FIELD_CONTRACT_VERSION,
} from "./field-contract";
import {
  getImbFieldContractChecksum,
  getImbTransformationChecksum,
} from "./engine";

describe("IMB field contract", () => {
  it("pins the approved v1 fields and restores written scripture", () => {
    expect(IMB_FIELD_CONTRACT_VERSION).toBe(1);
    expect(IMB_FIELD_CONTRACT).toHaveLength(36);
    expect(IMB_FIELD_CONTRACT).toContainEqual({
      sourceField: "Bible",
      outputField: "Resources_Written_Scripture",
      type: "boolean",
      requiredSourceColumn: false,
    });
    expect(IMB_FIELD_CONTRACT.slice(-4).map((entry) => entry.outputField)).toEqual([
      "Data_Source",
      "Dataset_ID",
      "Dataset_Row_ID",
      "Dataset_Row_Key",
    ]);
  });

  it("produces stable SHA-256 contract and transformation checksums", () => {
    expect(getImbFieldContractChecksum()).toMatch(/^[0-9a-f]{64}$/u);
    expect(getImbTransformationChecksum()).toMatch(/^[0-9a-f]{64}$/u);
    expect(getImbFieldContractChecksum()).toBe(getImbFieldContractChecksum());
  });
});
