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

  it("renders linked dataset names for viewers in read-only mode", () => {
    render(
      <FieldDefinitionsClient
        canEdit={false}
        initialFieldDefinitions={[
          {
            id: "field-1",
            canonicalKey: "geo_country_name",
            label: "Geo Country Name",
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

    expect(screen.getByText("Global")).toBeTruthy();
    expect(screen.getByText("Joshua Project")).toBeTruthy();
    expect(screen.queryByText("Save definition")).toBeNull();
    expect(screen.getByText("No definition available yet.")).toBeTruthy();
  });

  it("lets admins update a field definition", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        fieldDefinition: {
          id: "field-1",
          canonicalKey: "geo_country_name",
          label: "Geo Country Name",
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
            label: "Geo Country Name",
            definition: "",
            linkedDatasets: [{ id: "dataset-1", fileName: "Global" }],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ]}
      />,
    );

    fireEvent.change(screen.getByLabelText("Definition"), {
      target: { value: "The country assigned to the row." },
    });
    fireEvent.click(screen.getByText("Save definition"));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/field-definitions/field-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          definition: "The country assigned to the row.",
        }),
      });
    });
    expect(screen.getByText("Saved Geo Country Name.")).toBeTruthy();
  });
});
