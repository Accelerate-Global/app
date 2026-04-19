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

  it("deduplicates frontier aliases and aggregates linked datasets onto the canonical row", async () => {
    const canonicalRow = {
      id: "field-canonical",
      canonicalKey: "christianity_frontier_group",
      label: "Christianity_Frontier_Group",
      displayLabel: "Frontier Group",
      definition: "Frontier definition",
      hideFromViewerFieldDefinitions: false,
      mappingFieldId: "F_2",
      mappingDataType: "Boolean",
      mappingIsActive: true,
      sourcePriorityKeys: ["joshua_project"],
      createdAt: new Date("2026-04-15T00:00:00.000Z"),
      updatedAt: new Date("2026-04-15T00:00:00.000Z"),
    };
    const aliasRow = {
      ...canonicalRow,
      id: "field-alias",
      canonicalKey: "frontier_group",
      label: "Frontier_Group",
      displayLabel: "",
      definition: "",
      sourcePriorityKeys: [],
      createdAt: new Date("2026-04-16T00:00:00.000Z"),
    };
    const db = {
      select: vi.fn(() => ({
        from: vi.fn((table) => {
          if (table === fieldDefinitions) {
            return {
              orderBy: vi.fn().mockResolvedValue([canonicalRow, aliasRow]),
            };
          }

          if (table === datasets) {
            return {
              orderBy: vi.fn().mockResolvedValue([
                {
                  id: "dataset-1",
                  fileName: "Global Watchlist",
                  columns: [
                    {
                      key: "christianity_frontier_group",
                      label: "Christianity_Frontier_Group",
                      sourceIndex: 2,
                    },
                  ],
                },
                {
                  id: "dataset-2",
                  fileName: "UUPG Priority List",
                  columns: [
                    {
                      key: "frontier_group",
                      label: "Frontier_Group",
                      sourceIndex: 9,
                    },
                  ],
                },
              ]),
            };
          }

          throw new Error("Unexpected table");
        }),
      })),
    };

    getDbMock.mockReturnValue(db);
    listLinkedSourcesByFieldDefinitionIdMock.mockResolvedValue(
      new Map([
        [
          "field-canonical",
          [
            {
              id: "source-joshua",
              key: "joshua_project",
              label: "Joshua Project",
            },
          ],
        ],
      ]),
    );

    const { listFieldDefinitions } = await import("./field-definitions");
    const result = await listFieldDefinitions({ includeHidden: true });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "field-canonical",
      canonicalKey: "christianity_frontier_group",
      linkedDatasets: [
        { id: "dataset-1", fileName: "Global Watchlist" },
        { id: "dataset-2", fileName: "UUPG Priority List" },
      ],
      linkedSources: [
        {
          id: "source-joshua",
          key: "joshua_project",
          label: "Joshua Project",
        },
      ],
    });
    expect(listLinkedSourcesByFieldDefinitionIdMock).toHaveBeenCalledWith([
      {
        id: "field-canonical",
        sourcePriorityKeys: ["joshua_project"],
      },
    ]);
  });

  it("maps the frontier alias column to the canonical field presentation", async () => {
    const canonicalRow = {
      id: "field-canonical",
      canonicalKey: "christianity_frontier_group",
      label: "Christianity_Frontier_Group",
      displayLabel: "Frontier Group",
      definition: "Frontier definition",
      hideFromViewerFieldDefinitions: false,
      mappingFieldId: "F_2",
      mappingDataType: "Boolean",
      mappingIsActive: true,
      sourcePriorityKeys: ["joshua_project"],
      createdAt: new Date("2026-04-15T00:00:00.000Z"),
      updatedAt: new Date("2026-04-15T00:00:00.000Z"),
    };
    const db = {
      select: vi.fn(() => ({
        from: vi.fn((table) => {
          if (table === fieldDefinitions) {
            return {
              where: vi.fn().mockResolvedValue([canonicalRow]),
            };
          }

          throw new Error("Unexpected table");
        }),
      })),
    };

    getDbMock.mockReturnValue(db);
    listLinkedSourcesByFieldDefinitionIdMock.mockResolvedValue(
      new Map([
        [
          "field-canonical",
          [
            {
              id: "source-joshua",
              key: "joshua_project",
              label: "Joshua Project",
            },
          ],
        ],
      ]),
    );

    const { listFieldDefinitionPresentationByColumnKey } = await import(
      "./field-definitions"
    );
    const result = await listFieldDefinitionPresentationByColumnKey([
      {
        key: "frontier_group",
        label: "Frontier_Group",
        sourceIndex: 0,
      },
    ]);

    expect(result.frontier_group).toEqual({
      definition: "Frontier definition",
      displayLabel: "Frontier Group",
      effectiveLabel: "Frontier Group",
      linkedSources: [
        {
          id: "source-joshua",
          key: "joshua_project",
          label: "Joshua Project",
        },
      ],
    });
  });
});
