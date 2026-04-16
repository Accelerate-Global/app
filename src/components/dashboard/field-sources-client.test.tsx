// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { FieldSourceGridRow, FieldSourceType } from "@/lib/api-types";

import { FieldSourcesClient } from "./field-sources-client";

describe("FieldSourcesClient", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    global.fetch = vi.fn() as typeof fetch;
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the simplified table without field metadata columns or helper copy", () => {
    const fieldSourceTypes: FieldSourceType[] = [
      {
        id: "source-1",
        key: "joshua_project",
        label: "Joshua Project",
        sortOrder: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const fieldSources: FieldSourceGridRow[] = [
      {
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
      },
    ];

    const { container } = render(
      <FieldSourcesClient
        initialFieldSourceTypes={fieldSourceTypes}
        initialFieldSources={fieldSources}
      />,
    );

    expect(
      screen.queryByRole("columnheader", { name: "Field ID" }),
    ).toBeNull();
    expect(
      screen.queryByRole("columnheader", { name: "Active" }),
    ).toBeNull();
    expect(screen.queryByText(/Display label overrides/i)).toBeNull();
    expect(screen.getByText("Country Name")).toBeTruthy();

    const scrollArea = container.querySelector(
      '[data-slot="data-grid-scroll-area"]',
    );
    expect(scrollArea).toBeTruthy();
    expect(scrollArea?.className).toContain("h-[560px]");
  });
});
