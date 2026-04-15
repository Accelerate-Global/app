import { beforeEach, describe, expect, it, vi } from "vitest";

import { datasets, fieldDefinitions } from "@/db/schema";

const getDbMock = vi.fn();
const listLinkedSourcesByFieldDefinitionIdMock = vi.fn();

vi.mock("@/db", () => ({
  getDb: getDbMock,
}));

vi.mock("@/lib/field-sources", () => ({
  listLinkedSourcesByFieldDefinitionId: listLinkedSourcesByFieldDefinitionIdMock,
}));

describe("field-definitions data access", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("filters hidden field definitions for viewer listings", async () => {
    const rows = [
      {
        id: "field-1",
        canonicalKey: "country_name",
        label: "Country Name",
        displayLabel: "",
        definition: "",
        hideFromViewerFieldDefinitions: false,
        mappingFieldId: null,
        mappingDataType: null,
        mappingIsActive: null,
        sourcePriorityKeys: [],
        createdAt: new Date("2026-04-15T00:00:00.000Z"),
        updatedAt: new Date("2026-04-15T00:00:00.000Z"),
      },
      {
        id: "field-2",
        canonicalKey: "source_code",
        label: "Source Code",
        displayLabel: "",
        definition: "",
        hideFromViewerFieldDefinitions: true,
        mappingFieldId: null,
        mappingDataType: null,
        mappingIsActive: null,
        sourcePriorityKeys: [],
        createdAt: new Date("2026-04-15T00:00:00.000Z"),
        updatedAt: new Date("2026-04-15T00:00:00.000Z"),
      },
    ];
    const db = {
      select: vi.fn(() => ({
        from: vi.fn((table) => {
          if (table === fieldDefinitions) {
            return {
              orderBy: vi.fn().mockResolvedValue(rows),
            };
          }

          if (table === datasets) {
            return {
              orderBy: vi.fn().mockResolvedValue([]),
            };
          }

          throw new Error("Unexpected table");
        }),
      })),
    };

    getDbMock.mockReturnValue(db);
    listLinkedSourcesByFieldDefinitionIdMock.mockResolvedValue(new Map());

    const { listFieldDefinitions } = await import("./field-definitions");
    const result = await listFieldDefinitions({ includeHidden: false });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "field-1",
      hideFromViewerFieldDefinitions: false,
    });
    expect(listLinkedSourcesByFieldDefinitionIdMock).toHaveBeenCalledWith([
      {
        id: "field-1",
        sourcePriorityKeys: [],
      },
    ]);
  });

  it("persists the viewer visibility flag on update", async () => {
    const updatedRow = {
      id: "field-1",
      canonicalKey: "country_name",
      label: "Country Name",
      displayLabel: "Country",
      definition: "Country definition",
      hideFromViewerFieldDefinitions: true,
      mappingFieldId: null,
      mappingDataType: null,
      mappingIsActive: null,
      sourcePriorityKeys: [],
      createdAt: new Date("2026-04-15T00:00:00.000Z"),
      updatedAt: new Date("2026-04-15T00:00:00.000Z"),
    };
    const setMock = vi.fn(() => ({
      where: vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([updatedRow]),
      })),
    }));
    const db = {
      update: vi.fn(() => ({
        set: setMock,
      })),
      select: vi.fn(() => ({
        from: vi.fn((table) => {
          if (table === datasets) {
            return {
              orderBy: vi.fn().mockResolvedValue([]),
            };
          }

          throw new Error("Unexpected select table");
        }),
      })),
    };

    getDbMock.mockReturnValue(db);
    listLinkedSourcesByFieldDefinitionIdMock.mockResolvedValue(new Map());

    const { updateFieldDefinition } = await import("./field-definitions");
    const result = await updateFieldDefinition({
      fieldDefinitionId: "field-1",
      displayLabel: " Country ",
      definition: " Country definition ",
      hideFromViewerFieldDefinitions: true,
    });

    expect(result).toMatchObject({
      id: "field-1",
      displayLabel: "Country",
      definition: "Country definition",
      hideFromViewerFieldDefinitions: true,
    });
    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({
        displayLabel: "Country",
        definition: "Country definition",
        hideFromViewerFieldDefinitions: true,
      }),
    );
  });
});
