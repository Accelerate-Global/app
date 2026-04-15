// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
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
            hideFromViewerFieldDefinitions: false,
            linkedDatasets: [
              { id: "dataset-1", fileName: "Global" },
              { id: "dataset-2", fileName: "Joshua Project" },
            ],
            linkedSources: [
              {
                id: "source-1",
                key: "joshua_project",
                label: "Joshua Project",
              },
              {
                id: "source-2",
                key: "imb_people_groups",
                label: "IMB (People Groups)",
              },
            ],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ]}
      />,
    );

    expect(screen.getAllByText("Country Name").length).toBeGreaterThan(0);
    expect(screen.queryByText("Global")).toBeNull();
    expect(screen.getAllByText("Joshua Project").length).toBeGreaterThan(0);
    expect(
      screen.getAllByText("IMB (People Groups)").length,
    ).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Edit Country Name" })).toBeNull();
    expect(screen.getAllByText("No definition available yet.").length).toBeGreaterThan(0);
  });

  it("lets admins update the display label and definition from the sheet", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        fieldDefinition: {
          id: "field-1",
          canonicalKey: "geo_country_name",
          label: "Geo_country_name",
          displayLabel: "Country Name",
          definition: "The country assigned to the row.",
          hideFromViewerFieldDefinitions: true,
          linkedDatasets: [{ id: "dataset-1", fileName: "Global" }],
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
            hideFromViewerFieldDefinitions: false,
            linkedDatasets: [{ id: "dataset-1", fileName: "Global" }],
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
        ]}
      />,
    );

    fireEvent.click(
      screen.getAllByRole("button", { name: "Edit Geo_country_name" })[0],
    );

    const dialog = await screen.findByRole("dialog", { name: "Edit field" });

    fireEvent.change(within(dialog).getByLabelText("Display label"), {
      target: { value: "Country Name" },
    });
    fireEvent.change(within(dialog).getByLabelText("Definition"), {
      target: { value: "The country assigned to the row." },
    });
    fireEvent.click(
      within(dialog).getByRole("switch", {
        name: "Hide from viewer Field Definitions page",
      }),
    );
    expect(within(dialog).getByText("Sources")).toBeTruthy();
    expect(within(dialog).getAllByText("Joshua Project").length).toBeGreaterThan(
      0,
    );
    fireEvent.click(within(dialog).getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/field-definitions/field-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayLabel: "Country Name",
          definition: "The country assigned to the row.",
          hideFromViewerFieldDefinitions: true,
        }),
      });
    });
    expect(screen.queryByRole("dialog", { name: "Edit field" })).toBeNull();
    expect(screen.getAllByText("Country Name").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Hidden from viewers").length).toBeGreaterThan(0);
    expect(
      screen.getAllByText("The country assigned to the row.").length,
    ).toBeGreaterThan(0);
  });
});
