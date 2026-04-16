import { beforeEach, describe, expect, it, vi } from "vitest";

import { getTableName } from "drizzle-orm";

import {
  fieldDefinitions,
  fieldDefinitionSources,
  fieldSourceTypes,
} from "@/db/schema";

const getDbMock = vi.fn();

vi.mock("@/db", () => ({
  getDb: getDbMock,
}));

describe("field-source registry seed", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
  });

  it("replaces matched source links from the mapping csv and aliases Add-on Fields to Accelerate", async () => {
    const fieldSourceTypesOnConflictDoUpdateMock = vi
      .fn()
      .mockResolvedValue(undefined);
    const fieldSourceTypesValuesMock = vi.fn(() => ({
      onConflictDoUpdate: fieldSourceTypesOnConflictDoUpdateMock,
    }));
    const fieldDefinitionsOnConflictDoUpdateMock = vi
      .fn()
      .mockResolvedValue(undefined);
    const fieldDefinitionsValuesMock = vi.fn(() => ({
      onConflictDoUpdate: fieldDefinitionsOnConflictDoUpdateMock,
    }));
    const fieldDefinitionSourcesOnConflictDoNothingMock = vi
      .fn()
      .mockResolvedValue(undefined);
    const fieldDefinitionSourcesValuesMock = vi.fn(() => ({
      onConflictDoNothing: fieldDefinitionSourcesOnConflictDoNothingMock,
    }));
    const fieldDefinitionSourcesDeleteWhereMock = vi
      .fn()
      .mockResolvedValue(undefined);
    const fieldSourceTypesDeleteWhereMock = vi.fn().mockResolvedValue(undefined);
    const selectResponses = [
      [
        { id: "source-joshua", key: "joshua_project" },
        { id: "source-imb", key: "imb_people_groups" },
        { id: "source-etno", key: "etnopedia" },
        { id: "source-accelerate", key: "accelerate" },
      ],
      [
        { id: "field-frontier", canonicalKey: "christianity_frontier_group" },
        { id: "field-data-source", canonicalKey: "data_source" },
        { id: "field-govt-freedom", canonicalKey: "govt_freedom_index" },
      ],
      [{ id: "source-add-on" }],
      [],
    ];
    let selectIndex = 0;
    const tx = {
      insert: vi.fn((table) => {
        if (getTableName(table) === getTableName(fieldSourceTypes)) {
          return {
            values: fieldSourceTypesValuesMock,
          };
        }

        if (getTableName(table) === getTableName(fieldDefinitions)) {
          return {
            values: fieldDefinitionsValuesMock,
          };
        }

        if (getTableName(table) === getTableName(fieldDefinitionSources)) {
          return {
            values: fieldDefinitionSourcesValuesMock,
          };
        }

        throw new Error("Unexpected insert table");
      }),
      select: vi.fn(() => {
        const whereMock = vi.fn().mockImplementation(async () => {
          const response = selectResponses[selectIndex];
          selectIndex += 1;
          return response ?? [];
        });

        return {
          from: vi.fn(() => ({
            where: whereMock,
          })),
        };
      }),
      delete: vi.fn((table) => {
        if (getTableName(table) === getTableName(fieldDefinitionSources)) {
          return {
            where: fieldDefinitionSourcesDeleteWhereMock,
          };
        }

        if (getTableName(table) === getTableName(fieldSourceTypes)) {
          return {
            where: fieldSourceTypesDeleteWhereMock,
          };
        }

        throw new Error("Unexpected delete table");
      }),
    };

    getDbMock.mockReturnValue({
      transaction: async (callback: (transaction: typeof tx) => Promise<void>) =>
        callback(tx),
    });

    const { seedFieldSourceRegistryIfNeeded } = await import("./field-sources");

    await seedFieldSourceRegistryIfNeeded();

    expect(fieldDefinitionsValuesMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          canonicalKey: "christianity_frontier_group",
          label: "Christianity_Frontier_Group",
          displayLabel: "Christianity: Frontier Group Y/N",
        }),
      ]),
    );
    const upsertConfig = fieldDefinitionsOnConflictDoUpdateMock.mock.calls[0]?.[0];
    const seededSourceTypes = (
      fieldSourceTypesValuesMock.mock.calls as unknown as Array<
        [Array<{ label: string; key: string }>]
      >
    )[0]?.[0];
    const seededFieldDefinitionSources = (
      fieldDefinitionSourcesValuesMock.mock.calls as unknown as Array<
        [
          Array<{
            fieldDefinitionId: string;
            sourceTypeId: string;
            sourceFieldName: string;
          }>,
        ]
      >
    )[0]?.[0];
    const sourceConflictTarget = (
      fieldDefinitionSourcesOnConflictDoNothingMock.mock.calls as unknown as Array<
        [{ target: Array<{ name: string }> }]
      >
    )[0]?.[0]?.target;

    expect(upsertConfig?.target.name).toBe(fieldDefinitions.canonicalKey.name);
    expect(upsertConfig?.set.displayLabel).toBeDefined();
    expect(fieldSourceTypesValuesMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          key: "accelerate",
          label: "Accelerate",
        }),
      ]),
    );
    expect(seededSourceTypes).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Add-on Fields",
        }),
      ]),
    );
    expect(fieldDefinitionSourcesDeleteWhereMock).toHaveBeenCalledTimes(1);
    expect(fieldDefinitionSourcesValuesMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          fieldDefinitionId: "field-frontier",
          sourceTypeId: "source-joshua",
          sourceFieldName: "Frontier",
        }),
        expect.objectContaining({
          fieldDefinitionId: "field-data-source",
          sourceTypeId: "source-accelerate",
          sourceFieldName: "Data Source",
        }),
      ]),
    );
    expect(seededFieldDefinitionSources).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldDefinitionId: "field-govt-freedom",
        }),
      ]),
    );
    expect(fieldDefinitionSourcesOnConflictDoNothingMock).toHaveBeenCalledTimes(1);
    expect(sourceConflictTarget?.map((column) => column.name)).toEqual([
      fieldDefinitionSources.fieldDefinitionId.name,
      fieldDefinitionSources.sourceTypeId.name,
    ]);
    expect(fieldSourceTypesDeleteWhereMock).toHaveBeenCalledTimes(1);
    expect(selectIndex).toBe(selectResponses.length);
  });
});
