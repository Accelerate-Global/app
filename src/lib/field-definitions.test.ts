import { describe, expect, it, vi } from "vitest";

import type { CsvColumn } from "@/lib/api-types";
import {
  getFieldDefinitionCanonicalKey,
  syncFieldDefinitionsForColumns,
} from "@/lib/field-definitions";

describe("field-definitions", () => {
  it("normalizes case and punctuation variants to the same canonical key", () => {
    expect(getFieldDefinitionCanonicalKey("Geo Country Name", 0)).toBe(
      "geo_country_name",
    );
    expect(getFieldDefinitionCanonicalKey(" geo-country-name ", 7)).toBe(
      "geo_country_name",
    );
  });

  it("maps duplicate stored dataset keys back to one field definition identity", () => {
    expect(getFieldDefinitionCanonicalKey("People Group", 0)).toBe(
      "people_group",
    );
    expect(getFieldDefinitionCanonicalKey("People Group", 1)).toBe(
      "people_group",
    );
  });

  it("syncs only one field definition per canonical field", async () => {
    const onConflictDoNothingMock = vi.fn().mockResolvedValue(undefined);
    const valuesMock = vi.fn(() => ({
      onConflictDoNothing: onConflictDoNothingMock,
    }));
    const insertMock = vi.fn(() => ({
      values: valuesMock,
    }));

    await syncFieldDefinitionsForColumns({
      columns: [
        {
          key: "people_group",
          label: "People Group",
          sourceIndex: 0,
        },
        {
          key: "people_group_2",
          label: "People Group",
          sourceIndex: 1,
        },
      ] satisfies CsvColumn[],
      executor: {
        insert: insertMock,
      },
    });

    expect(valuesMock).toHaveBeenCalledTimes(1);
    expect(valuesMock).toHaveBeenCalledWith([
      {
        canonicalKey: "people_group",
        label: "People Group",
      },
    ]);
    expect(onConflictDoNothingMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to generated column identities when the label is blank", async () => {
    const onConflictDoNothingMock = vi.fn().mockResolvedValue(undefined);
    const valuesMock = vi.fn(() => ({
      onConflictDoNothing: onConflictDoNothingMock,
    }));
    const insertMock = vi.fn(() => ({
      values: valuesMock,
    }));

    await syncFieldDefinitionsForColumns({
      columns: [
        {
          key: "column_4",
          label: "",
          sourceIndex: 3,
        },
      ] satisfies CsvColumn[],
      executor: {
        insert: insertMock,
      },
    });

    expect(valuesMock).toHaveBeenCalledWith([
      {
        canonicalKey: "column_4",
        label: "Column 4",
      },
    ]);
  });
});
