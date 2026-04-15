// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardClient } from "./dashboard-client";

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
        label: "Priority",
        color: "#262531",
      },
    ],
    error: null,
    createdAt: new Date("2026-04-15T16:00:00.000Z").toISOString(),
    updatedAt: new Date("2026-04-15T16:00:00.000Z").toISOString(),
  };
}

describe("DashboardClient", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("opens and closes the dataset edit sheet while keeping the existing footer actions", async () => {
    render(
      <DashboardClient initialDatasets={[createDataset()]} canManageDatasets />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    const dialog = await screen.findByRole("dialog", { name: "Edit dataset" });

    expect(within(dialog).getByRole("button", { name: "Replace dataset" })).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "Save changes" })).toBeTruthy();
    expect(within(dialog).getAllByRole("button", { name: "Close" }).length).toBe(2);

    const closeButtons = within(dialog).getAllByRole("button", { name: "Close" });
    fireEvent.click(closeButtons[closeButtons.length - 1]);

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Edit dataset" })).toBeNull();
    });
  });

  it("routes to dataset replacement from the edit sheet", async () => {
    render(
      <DashboardClient initialDatasets={[createDataset()]} canManageDatasets />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    const dialog = await screen.findByRole("dialog", { name: "Edit dataset" });

    fireEvent.click(within(dialog).getByRole("button", { name: "Replace dataset" }));

    expect(pushMock).toHaveBeenCalledWith("/dashboard/upload?replace=dataset-1");
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Edit dataset" })).toBeNull();
    });
  });
});
