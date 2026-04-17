// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DatasetEditSheet } from "./dataset-edit-sheet";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

function createDataset() {
  return {
    id: "dataset-1",
    sortOrder: 0,
    fileName: "Global.csv",
    blobUrl: "https://example.com/global.csv",
    blobPath: "datasets/global.csv",
    isPrimary: true,
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

describe("DatasetEditSheet", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders upload history and reverts a historical version", async () => {
    const onRevertDatasetVersion = vi.fn(async () => undefined);
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    render(
      <DatasetEditSheet
        dataset={createDataset()}
        availableTags={[]}
        versions={[
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
        open
        isSaving={false}
        isDeleting={false}
        isLoadingVersions={false}
        versionHistoryError={null}
        revertingVersionId={null}
        onOpenChange={vi.fn()}
        onSaveDataset={vi.fn(async () => undefined)}
        onDeleteDataset={vi.fn(async () => undefined)}
        onRevertDatasetVersion={onRevertDatasetVersion}
      />,
    );

    const dialog = await screen.findByRole("dialog", { name: "Edit dataset" });

    expect(within(dialog).getByText("Upload history")).toBeTruthy();
    expect(within(dialog).getByText("Global-upload.csv")).toBeTruthy();

    fireEvent.click(
      within(
        dialog.querySelector('[data-smoke-dataset-version-row="dataset-version-0"]') as HTMLElement,
      ).getByRole("button", { name: "Revert" }),
    );

    expect(confirmSpy).toHaveBeenCalledWith(
      expect.stringContaining("Revert to Global-upload.csv"),
    );
    await waitFor(() => {
      expect(onRevertDatasetVersion).toHaveBeenCalledWith("dataset-version-0");
    });

    confirmSpy.mockRestore();
  }, 10000);

  it("opens the tag color dropdown and updates the selected color without crashing", async () => {
    render(
      <DatasetEditSheet
        dataset={createDataset()}
        availableTags={[]}
        open
        isSaving={false}
        isDeleting={false}
        versions={[]}
        isLoadingVersions={false}
        versionHistoryError={null}
        revertingVersionId={null}
        onOpenChange={vi.fn()}
        onSaveDataset={vi.fn(async () => undefined)}
        onDeleteDataset={vi.fn(async () => undefined)}
        onRevertDatasetVersion={vi.fn(async () => undefined)}
      />,
    );

    const dialog = await screen.findByRole("dialog", { name: "Edit dataset" });
    const existingTagColorSelect = within(dialog)
      .getAllByRole("combobox")
      .find((element) => element.textContent?.includes("Yellow"));

    expect(existingTagColorSelect).toBeTruthy();
    expect(existingTagColorSelect?.textContent).toContain("Yellow");

    fireEvent.click(existingTagColorSelect!);

    expect(await screen.findByRole("listbox")).toBeTruthy();
    const blueOption = await screen.findByRole("option", { name: "Blue" });
    expect(blueOption).toBeTruthy();

    fireEvent.mouseMove(blueOption);

    await waitFor(() => {
      expect(screen.getByRole("option", { name: "Blue" }).getAttribute("tabindex")).toBe("0");
    });

    fireEvent.click(screen.getByRole("option", { name: "Blue" }));

    await waitFor(() => {
      expect(existingTagColorSelect?.textContent).toContain("Blue");
    });
  });

  it("shows an error when a saved preset tag needs unsupported dataset filters", async () => {
    render(
      <DatasetEditSheet
        dataset={createDataset()}
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
        open
        isSaving={false}
        isDeleting={false}
        versions={[]}
        isLoadingVersions={false}
        versionHistoryError={null}
        revertingVersionId={null}
        onOpenChange={vi.fn()}
        onSaveDataset={vi.fn(async () => undefined)}
        onDeleteDataset={vi.fn(async () => undefined)}
        onRevertDatasetVersion={vi.fn(async () => undefined)}
      />,
    );

    const dialog = await screen.findByRole("dialog", { name: "Edit dataset" });

    fireEvent.click(
      within(dialog).getByRole("button", { name: "North Africa preset" }),
    );

    expect(
      within(dialog).getByText(
        'The "North Africa preset" tag preset needs Region filtering support on this dataset.',
      ),
    ).toBeTruthy();
  });

  it("keeps the dataset footer actions grouped into two rows", async () => {
    render(
      <DatasetEditSheet
        dataset={createDataset()}
        availableTags={[]}
        open
        isSaving={false}
        isDeleting={false}
        versions={[]}
        isLoadingVersions={false}
        versionHistoryError={null}
        revertingVersionId={null}
        onOpenChange={vi.fn()}
        onSaveDataset={vi.fn(async () => undefined)}
        onDeleteDataset={vi.fn(async () => undefined)}
        onRevertDatasetVersion={vi.fn(async () => undefined)}
      />,
    );

    const dialog = await screen.findByRole("dialog", { name: "Edit dataset" });
    const footer = dialog.querySelector('[data-slot="sheet-footer"]');

    expect(footer).toBeTruthy();

    const footerRows = Array.from(footer?.children ?? []);
    expect(footerRows).toHaveLength(2);

    const [topRow, bottomRow] = footerRows;

    expect(
      within(topRow as HTMLElement).getByRole("button", { name: "Replace dataset" }),
    ).toBeTruthy();
    expect(
      within(topRow as HTMLElement).getByRole("button", { name: "Close" }),
    ).toBeTruthy();
    expect(
      within(topRow as HTMLElement).getByRole("button", { name: "Save changes" }),
    ).toBeTruthy();
    expect(
      within(bottomRow as HTMLElement).getByRole("button", { name: "Delete dataset" }),
    ).toBeTruthy();
  });
});
