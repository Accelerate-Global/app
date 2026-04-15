// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FieldDefinitionsClient } from "./field-definitions-client";

const fetchMock = vi.fn();

describe("FieldDefinitionsClient", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    global.fetch = fetchMock as typeof fetch;
  });

  afterEach(() => {
    cleanup();
  });

  it("renders audience-facing copy and read-only field rows for viewers", () => {
    render(
      <FieldDefinitionsClient
        canEdit={false}
        initialFieldDefinitions={[
          {
            id: "field-1",
            canonicalKey: "geo_country_name",
            label: "Geo_country_name",
            displayLabel: "Country Name",
            definition: "",
            linkedDatasets: [
              { id: "dataset-1", fileName: "Global" },
              { id: "dataset-2", fileName: "Joshua Project" },
            ],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ]}
      />,
    );

    expect(
      screen.getByText(
        "These shared definitions explain fields that appear across the datasets in this workspace.",
      ),
    ).toBeTruthy();
    expect(screen.getAllByText("Country Name").length).toBeGreaterThan(0);
    expect(screen.queryByText("Global")).toBeNull();
    expect(screen.queryByText("Joshua Project")).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit Country Name" })).toBeNull();
    expect(screen.getAllByText("No definition available yet.").length).toBeGreaterThan(0);
  });

  it("lets admins update the display label and definition from the drawer", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        fieldDefinition: {
          id: "field-1",
          canonicalKey: "geo_country_name",
          label: "Geo_country_name",
          displayLabel: "Country Name",
          definition: "The country assigned to the row.",
          linkedDatasets: [{ id: "dataset-1", fileName: "Global" }],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      }),
    });

    render(
      <FieldDefinitionsClient
        canEdit
        initialFieldDefinitions={[
          {
            id: "field-1",
            canonicalKey: "geo_country_name",
            label: "Geo_country_name",
            displayLabel: "",
            definition: "",
            linkedDatasets: [{ id: "dataset-1", fileName: "Global" }],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ]}
      />,
    );

    fireEvent.click(
      screen.getAllByRole("button", { name: "Edit Geo_country_name" })[0],
    );

    fireEvent.change(screen.getByLabelText("Display label"), {
      target: { value: "Country Name" },
    });
    fireEvent.change(screen.getByLabelText("Definition"), {
      target: { value: "The country assigned to the row." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/field-definitions/field-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayLabel: "Country Name",
          definition: "The country assigned to the row.",
        }),
      });
    });
    expect(screen.queryByText("Edit field")).toBeNull();
    expect(screen.getAllByText("Country Name").length).toBeGreaterThan(0);
    expect(
      screen.getAllByText("The country assigned to the row.").length,
    ).toBeGreaterThan(0);
  });
});
