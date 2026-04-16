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

describe("DatasetEditSheet", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("opens the tag color dropdown and updates the selected color without crashing", async () => {
    render(
      <DatasetEditSheet
        dataset={createDataset()}
        availableTags={[]}
        open
        isSaving={false}
        isDeleting={false}
        onOpenChange={vi.fn()}
        onSaveDataset={vi.fn(async () => undefined)}
        onDeleteDataset={vi.fn(async () => undefined)}
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
});
