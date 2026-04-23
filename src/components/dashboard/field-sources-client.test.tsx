// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { FieldSourceGridRow, FieldSourceType } from "@/lib/api-types";

import { FieldSourcesClient } from "./field-sources-client";

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
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the simplified read-only table without edit controls", () => {
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
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button", { name: "Add source" })).toBeNull();
    expect(
      screen.getByText(
        "Review which source fields currently map to each shared workspace field. These mappings are available here as read-only reference data.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Country Name")).toBeTruthy();
    expect(
      screen.getByRole("columnheader", { name: "Joshua Project" }),
    ).toBeTruthy();
    expect(screen.getByText("COUNTRY_NAME")).toBeTruthy();
    expect(
      container.querySelector('[data-smoke-field-source-value="field-1:source-1"]'),
    ).toBeTruthy();

    const scrollArea = container.querySelector(
      '[data-slot="data-grid-scroll-area"]',
    );
    expect(scrollArea).toBeTruthy();
    expect(scrollArea?.className).toContain("h-[560px]");
  });

  it("renders a muted Not tracked placeholder for blank source mappings", () => {
    const { container } = render(
      <FieldSourcesClient
        initialFieldSourceTypes={[createFieldSourceType()]}
        initialFieldSources={[
          createFieldSourceRow({
            sourceValues: {
              "source-1": "",
            },
          }),
        ]}
      />,
    );

    const valueCell = container.querySelector(
      '[data-smoke-field-source-value="field-1:source-1"]',
    );
    expect(valueCell).toBeTruthy();
    expect(within(valueCell as HTMLElement).getByText("Not tracked")).toBeTruthy();
  });

  it("keeps field sorting working with stable header render keys", () => {
    render(
      <FieldSourcesClient
        initialFieldSourceTypes={[createFieldSourceType()]}
        initialFieldSources={[
          createFieldSourceRow({
            fieldDefinitionId: "field-1",
            effectiveLabel: "Zulu",
            sourceValues: { "source-1": "Z_FIELD" },
          }),
          createFieldSourceRow({
            fieldDefinitionId: "field-2",
            effectiveLabel: "Abaza",
            sourceValues: { "source-1": "A_FIELD" },
          }),
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Field" }));

    const rows = screen.getAllByRole("row");
    const firstDataRow = rows[1];

    expect(within(firstDataRow).getByText("Abaza")).toBeTruthy();
  });
});
