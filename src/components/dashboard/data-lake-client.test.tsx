// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DataLakeClient } from "./data-lake-client";

const fetchMock = vi.fn();

describe("DataLakeClient", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    global.fetch = fetchMock as typeof fetch;
  });

  afterEach(() => {
    cleanup();
  });

  it("renders a read-only source catalog for viewers", () => {
    render(
      <DataLakeClient
        canEdit={false}
        initialSources={[
          {
            datasetId: "dataset-1",
            displayName: "Joshua Project",
            sourceOrganizationName: "Joshua Project",
            datasetFileName: "joshua-project-2026.csv",
            lastUploadAt: "2026-04-22T18:00:00.000Z",
            status: "ready",
            rowCount: 422,
            isPublic: true,
          },
          {
            datasetId: "dataset-2",
            displayName: "imb-april.csv",
            sourceOrganizationName: null,
            datasetFileName: "imb-april.csv",
            lastUploadAt: "2026-04-21T18:00:00.000Z",
            status: "processing",
            rowCount: 0,
            isPublic: true,
          },
        ]}
      />,
    );

    expect(screen.getByText("Incoming source feeds")).toBeTruthy();
    expect(screen.getByText("Joshua Project")).toBeTruthy();
    expect(screen.getAllByText("imb-april.csv").length).toBeGreaterThan(0);
    expect(screen.getByText("Uses dataset filename")).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: /Rename organization for/i }),
    ).toBeNull();
  });

  it("lets admins rename an organization label inline", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        dataset: {
          id: "dataset-1",
          fileName: "joshua-project-april.csv",
          sourceOrganizationName: "Joshua Project",
        },
      }),
    });

    render(
      <DataLakeClient
        canEdit
        initialSources={[
          {
            datasetId: "dataset-1",
            displayName: "joshua-project-april.csv",
            sourceOrganizationName: null,
            datasetFileName: "joshua-project-april.csv",
            lastUploadAt: "2026-04-22T18:00:00.000Z",
            status: "ready",
            rowCount: 422,
            isPublic: true,
          },
        ]}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Rename organization for joshua-project-april.csv",
      }),
    );

    fireEvent.change(
      screen.getByRole("textbox", {
        name: "Organization name for joshua-project-april.csv",
      }),
      {
        target: { value: " Joshua Project " },
      },
    );

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/datasets/dataset-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceOrganizationName: "Joshua Project",
        }),
      });
    });

    expect(screen.getByText("Joshua Project")).toBeTruthy();
    expect(screen.queryByText("Uses dataset filename")).toBeNull();
  });
});
