// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { FieldSourceGridRow, FieldSourceType } from "@/lib/api-types";

import { FieldSourcesClient } from "./field-sources-client";

const fetchMock = vi.fn();
const { trackAppEventMock } = vi.hoisted(() => ({
  trackAppEventMock: vi.fn(),
}));

vi.mock("@/lib/analytics-client", () => ({
  trackAppEvent: trackAppEventMock,
}));

function createFieldSourceType(overrides: Partial<FieldSourceType> = {}): FieldSourceType {
  return {
    id: "source-1",
    key: "joshua_project",
    label: "Joshua Project",
    sortOrder: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function createFieldSourceRow(
  overrides: Partial<FieldSourceGridRow> = {},
): FieldSourceGridRow {
  return {
    fieldDefinitionId: "field-1",
    canonicalKey: "geo_country_name",
    label: "Geo_country_name",
    displayLabel: "Country Name",
    effectiveLabel: "Country Name",
    definition: "",
    mappingFieldId: "F_1",
    mappingDataType: "Text",
    mappingIsActive: true,
    sourcePriorityKeys: ["joshua_project"],
    sourceValues: {
      "source-1": "COUNTRY_NAME",
    },
    linkedSources: [
      {
        id: "source-1",
        key: "joshua_project",
        label: "Joshua Project",
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("FieldSourcesClient", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    global.fetch = fetchMock as typeof fetch;
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the simplified table without field metadata columns or helper copy", () => {
    const { container } = render(
      <FieldSourcesClient
        initialFieldSourceTypes={[createFieldSourceType()]}
        initialFieldSources={[createFieldSourceRow()]}
      />,
    );

    expect(
      screen.queryByRole("columnheader", { name: "Field ID" }),
    ).toBeNull();
    expect(
      screen.queryByRole("columnheader", { name: "Active" }),
    ).toBeNull();
    expect(
      screen.queryByRole("columnheader", { name: "Internal field" }),
    ).toBeNull();
    expect(
      screen.queryByRole("columnheader", { name: "Data type" }),
    ).toBeNull();
    expect(
      screen.queryByRole("columnheader", { name: "Priority order" }),
    ).toBeNull();
    expect(screen.queryByText(/Display label overrides/i)).toBeNull();
    expect(screen.getByText("Country Name")).toBeTruthy();
    expect(
      screen.getByRole("columnheader", { name: "Joshua Project" }),
    ).toBeTruthy();

    const scrollArea = container.querySelector(
      '[data-slot="data-grid-scroll-area"]',
    );
    expect(scrollArea).toBeTruthy();
    expect(scrollArea?.className).toContain("h-[560px]");
  });

  it("tracks source column creation without sending the raw label", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        fieldSourceType: createFieldSourceType({
          id: "source-2",
          key: "global_data",
          label: "Global Data",
        }),
      }),
    });

    render(
      <FieldSourcesClient
        initialFieldSourceTypes={[createFieldSourceType()]}
        initialFieldSources={[createFieldSourceRow()]}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("Source name"), {
      target: { value: "Global Data" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add source" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/field-source-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: "Global Data" }),
      });
    });
    expect(trackAppEventMock).toHaveBeenCalledWith(
      "field_source_type_created",
      expect.objectContaining({
        route: "field_sources",
        source_surface: "field_source_create_form",
        success: true,
        source_type_id: "source-2",
        label_length: 11,
      }),
    );
  });

  it("tracks field source value saves with ids only", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        fieldSource: createFieldSourceRow({
          sourceValues: {
            "source-1": "COUNTRY_CODE",
          },
        }),
      }),
    });

    render(
      <FieldSourcesClient
        initialFieldSourceTypes={[createFieldSourceType()]}
        initialFieldSources={[createFieldSourceRow()]}
      />,
    );

    const input = screen.getByDisplayValue("COUNTRY_NAME");

    fireEvent.change(input, {
      target: { value: "COUNTRY_CODE" },
    });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/field-sources/field-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceTypeId: "source-1",
          sourceFieldName: "COUNTRY_CODE",
        }),
      });
    });
    expect(trackAppEventMock).toHaveBeenCalledWith(
      "field_source_value_saved",
      expect.objectContaining({
        route: "field_sources",
        source_surface: "field_sources_grid",
        success: true,
        field_definition_id: "field-1",
        source_type_id: "source-1",
        has_value: true,
      }),
    );
  });
});
