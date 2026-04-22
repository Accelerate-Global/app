// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DatasetEditPageClient } from "./dataset-edit-page-client";

const pushMock = vi.fn();
const fetchMock = vi.fn();
const confirmMock = vi.fn();
const { trackAppEventMock } = vi.hoisted(() => ({
  trackAppEventMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

vi.mock("@/lib/analytics-client", () => ({
  trackAppEvent: trackAppEventMock,
}));

function createDataset(overrides: Record<string, unknown> = {}) {
  return {
    id: "dataset-1",
    backingDatasetId: null,
    sortOrder: 0,
    fileName: "Global.csv",
    blobUrl: "https://example.com/global.csv",
    blobPath: "datasets/global.csv",
    isPrimary: true,
    isPublic: true,
    status: "ready" as const,
    rowCount: 128,
    sizeBytes: 4096,
    columns: [
      {
        key: "people_group_id",
        label: "People Group ID",
        sourceIndex: 0,
      },
      {
        key: "country",
        label: "Country",
        sourceIndex: 1,
      },
    ],
    hiddenColumnKeys: [],
    tags: [
      {
        id: "tag-1",
        label: "PGAC",
        color: "#fcab2a",
      },
    ],
    error: null,
    createdAt: new Date("2026-04-15T16:00:00.000Z").toISOString(),
    updatedAt: new Date("2026-04-15T16:00:00.000Z").toISOString(),
    ...overrides,
  };
}

function createVersion(overrides: Record<string, unknown> = {}) {
  return {
    id: "dataset-version-1",
    datasetId: "dataset-1",
    isCurrent: true,
    fileName: "Global.csv",
    action: "upload" as const,
    actorOwnerId: "supabase-user",
    actorEmail: "admin@example.com",
    status: "ready" as const,
    rowCount: 128,
    sizeBytes: 4096,
    columnCount: 2,
    versionCreatedAt: new Date("2026-04-15T16:00:00.000Z").toISOString(),
    archivedAt: null,
    ...overrides,
  };
}

function buildJsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("DatasetEditPageClient", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("confirm", confirmMock);
    confirmMock.mockReturnValue(true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    cleanup();
  });

  it("renders upload history and reverts a historical version", async () => {
    fetchMock.mockImplementation(async (input, init) => {
      if (
        input === "/api/datasets/dataset-1/versions/dataset-version-0/revert" &&
        init?.method === "POST"
      ) {
        return buildJsonResponse({
          dataset: createDataset({
            updatedAt: new Date("2026-04-17T10:30:00.000Z").toISOString(),
          }),
        });
      }

      if (
        input === "/api/datasets/dataset-1/versions" &&
        (init?.method === undefined || init.method === "GET")
      ) {
        return buildJsonResponse({
          versions: [
            createVersion({
              action: "revert",
              versionCreatedAt: new Date("2026-04-17T10:30:00.000Z").toISOString(),
            }),
            createVersion({
              id: "dataset-version-0",
              isCurrent: false,
              fileName: "Global-upload.csv",
              action: "replace",
              actorEmail: "editor@example.com",
              rowCount: 120,
              versionCreatedAt: new Date("2026-04-14T12:00:00.000Z").toISOString(),
              archivedAt: new Date("2026-04-17T10:30:00.000Z").toISOString(),
            }),
          ],
        });
      }

      throw new Error(`Unexpected fetch: ${String(input)} ${init?.method ?? "GET"}`);
    });

    render(
      <DatasetEditPageClient
        initialDataset={createDataset()}
        availableTags={[]}
        initialVersions={[
          createVersion(),
          createVersion({
            id: "dataset-version-0",
            isCurrent: false,
            fileName: "Global-upload.csv",
            action: "replace",
            actorEmail: "editor@example.com",
            rowCount: 120,
            versionCreatedAt: new Date("2026-04-14T12:00:00.000Z").toISOString(),
            archivedAt: new Date("2026-04-15T16:00:00.000Z").toISOString(),
          }),
        ]}
      />,
    );

    expect(screen.getByText("Upload history")).toBeTruthy();
    expect(screen.getByText("Global-upload.csv")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Revert" }));

    expect(confirmMock).toHaveBeenCalledWith(
      expect.stringContaining("Revert to Global-upload.csv"),
    );
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/datasets/dataset-1/versions/dataset-version-0/revert",
        { method: "POST" },
      );
    });
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/datasets/dataset-1/versions");
    });
    expect(trackAppEventMock).toHaveBeenCalledWith(
      "dataset_version_reverted",
      expect.objectContaining({
        source_surface: "dataset_version_history",
        success: true,
        dataset_id: "dataset-1",
        version_id: "dataset-version-0",
      }),
    );
  });

  it("routes to dataset replacement from the edit page", () => {
    render(
      <DatasetEditPageClient
        initialDataset={createDataset()}
        availableTags={[]}
        initialVersions={[]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Replace dataset" }));

    expect(pushMock).toHaveBeenCalledWith("/dashboard/upload?replace=dataset-1");
  });

  it("routes derived dataset views to the backing dataset replacement flow", () => {
    render(
      <DatasetEditPageClient
        initialDataset={createDataset({
          backingDatasetId: "dataset-source-1",
          isPrimary: false,
        })}
        backingDatasetName="All People Groups"
        availableTags={[]}
        initialVersions={[
          createVersion({
            id: "dataset-version-0",
            isCurrent: false,
            fileName: "Global-upload.csv",
            action: "replace",
          }),
        ]}
      />,
    );

    expect(
      screen.getByText(/This dataset is a derived view backed by/i),
    ).toBeTruthy();
    expect(screen.getAllByText("All People Groups").length).toBeGreaterThan(0);
    expect(
      screen.getByText(
        /Revert remains available only on/i,
      ),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Revert" })).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: "Replace All People Groups" }),
    );

    expect(pushMock).toHaveBeenCalledWith(
      "/dashboard/upload?replace=dataset-source-1",
    );
  });

  it("shows an error when a saved preset tag needs unsupported dataset filters", async () => {
    render(
      <DatasetEditPageClient
        initialDataset={createDataset()}
        availableTags={[
          {
            id: "tag-2",
            label: "North Africa preset",
            color: "#078bc9",
            openPreset: {
              region: {
                enabled: true,
                selectedRegionIds: ["region-1"],
                selectedRegionNames: ["North Africa"],
                enabledCountryNames: ["Egypt"],
              },
              country: {
                enabled: false,
                selectedCountryNames: [],
              },
              watchlist: {
                enabled: false,
                thresholdEnabled: true,
                threshold: 2,
                engagementPhaseEnabled: true,
                engagementPhaseThreshold: 6,
                evangelicalBelieversEnabled: true,
                evangelicalBelieversThreshold: 1000,
                evangelicalPercentEnabled: true,
                evangelicalPercentThreshold: 0.05,
                frontierGroupEnabled: true,
                frontierGroupValue: true,
              },
              uupg: {
                enabled: false,
              },
            },
          },
        ]}
        initialVersions={[]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "North Africa preset" }));

    expect(
      screen.getByText(
        'The "North Africa preset" tag preset needs Region filtering support on this dataset.',
      ),
    ).toBeTruthy();
  });

  it("saves dataset visibility changes and returns to the dashboard", async () => {
    fetchMock.mockResolvedValue(
      buildJsonResponse({
        dataset: createDataset({
          fileName: "Global Updated.csv",
          isPrimary: false,
          isPublic: false,
          updatedAt: new Date("2026-04-17T11:00:00.000Z").toISOString(),
        }),
      }),
    );

    render(
      <DatasetEditPageClient
        initialDataset={createDataset()}
        availableTags={[]}
        initialVersions={[]}
      />,
    );

    fireEvent.change(screen.getByLabelText("Dataset name"), {
      target: { value: "Global Updated.csv" },
    });
    fireEvent.click(screen.getByRole("switch", { name: "Public dataset" }));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/datasets/dataset-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: "Global Updated.csv",
          tags: [
            {
              id: "tag-1",
              label: "PGAC",
              color: "#fcab2a",
            },
          ],
          isPrimary: false,
          isPublic: false,
          hiddenColumnKeys: [],
        }),
      });
    });
    expect(trackAppEventMock).toHaveBeenCalledWith(
      "dataset_metadata_saved",
      expect.objectContaining({
        source_surface: "dataset_edit_form",
        success: true,
        dataset_id: "dataset-1",
        renamed: true,
        primary_changed: true,
        visibility_changed: true,
        is_public: false,
        hidden_column_count: 0,
        tag_count: 1,
      }),
    );
    expect(pushMock).toHaveBeenCalledWith("/dashboard");
  });

  it("shows dataset delete failures inline", async () => {
    fetchMock.mockResolvedValue(
      buildJsonResponse({ error: "The dataset is locked." }, 409),
    );

    render(
      <DatasetEditPageClient
        initialDataset={createDataset()}
        availableTags={[]}
        initialVersions={[]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete dataset" }));

    expect(confirmMock).toHaveBeenCalledWith('Delete the dataset "Global.csv"?');
    expect(await screen.findByText("The dataset is locked.")).toBeTruthy();
    expect(trackAppEventMock).toHaveBeenCalledWith(
      "dataset_deleted",
      expect.objectContaining({
        source_surface: "dataset_edit_form",
        success: false,
        dataset_id: "dataset-1",
        error_code: "dataset_delete_failed",
      }),
    );
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("opens the tag color dropdown and updates the selected color", async () => {
    render(
      <DatasetEditPageClient
        initialDataset={createDataset()}
        availableTags={[]}
        initialVersions={[]}
      />,
    );

    const existingTagColorSelect = screen
      .getAllByRole("combobox")
      .find((element) => element.textContent?.includes("Yellow"));

    expect(existingTagColorSelect).toBeTruthy();

    fireEvent.click(existingTagColorSelect!);

    expect(await screen.findByRole("listbox")).toBeTruthy();
    const blueOption = await screen.findByRole("option", { name: "Blue" });

    fireEvent.mouseMove(blueOption);

    await waitFor(() => {
      expect(screen.getByRole("option", { name: "Blue" }).getAttribute("tabindex")).toBe("0");
    });

    fireEvent.click(screen.getByRole("option", { name: "Blue" }));

    await waitFor(() => {
      expect(existingTagColorSelect?.textContent).toContain("Blue");
    });
  });
});
