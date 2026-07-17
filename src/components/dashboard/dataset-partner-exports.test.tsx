// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DatasetPartnerExports } from "./dataset-partner-exports";

const sourceColumns = [
  { key: "pg_peopleid3", label: "PG_PeopleID3", sourceIndex: 0 },
  { key: "pg_name_main", label: "PG_Name_Main", sourceIndex: 1 },
];

function createProfile() {
  return {
    id: "profile-1",
    datasetId: "dataset-1",
    name: "Joshua Project export",
    partnerKey: "joshua-project",
    status: "active",
    fileNameStem: "joshua-project-export",
    revision: 1,
    columns: [
      {
        id: "column-1",
        ordinal: 0,
        outputHeader: "PG_PeopleID3",
        sourceColumnKeys: ["pg_peopleid3"],
        sourceLabelSnapshot: ["PG_PeopleID3"],
        transform: "copy",
        literalValue: null,
        required: false,
        requiredSeverity: "error",
      },
    ],
    createdByOwnerId: "admin-1",
    updatedByOwnerId: "admin-1",
    archivedByOwnerId: null,
    archivedAt: null,
    createdAt: "2026-07-15T06:00:00.000Z",
    updatedAt: "2026-07-15T06:00:00.000Z",
  };
}

function createRun(status: "queued" | "success") {
  return {
    id: "run-1",
    profileId: "profile-1",
    datasetId: "dataset-1",
    actorOwnerId: "admin-1",
    actorEmail: "admin@example.com",
    status,
    warningsAcknowledged: false,
    profileRevision: {},
    sourceSnapshot: {},
    validation: { errorCount: 0, warningCount: 0, findings: [], truncated: false },
    rowCount: status === "success" ? 1 : null,
    outputChecksum: status === "success" ? "checksum" : null,
    outputSizeBytes: status === "success" ? 20 : null,
    csvStoragePath: status === "success" ? "csv" : null,
    crosswalkStoragePath: status === "success" ? "crosswalk" : null,
    validationStoragePath: status === "success" ? "validation" : null,
    errorMessage: null,
    startedAt: null,
    completedAt: status === "success" ? "2026-07-15T06:01:00.000Z" : null,
    createdAt: "2026-07-15T06:00:00.000Z",
  };
}

describe("DatasetPartnerExports", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("opens a smoke-covered Joshua Project mapping sheet with exact-header suggestions", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({ profiles: [], runs: [] }),
      ),
    );

    render(
      <DatasetPartnerExports
        datasetId="dataset-1"
        sourceColumns={sourceColumns}
      />,
    );

    expect(await screen.findByText(/No export profiles yet/)).toBeTruthy();
    const trigger = screen.getByRole("button", { name: "New export profile" });
    expect(trigger.getAttribute("data-smoke-trigger")).toBe(
      "partner-export-profile-sheet",
    );
    fireEvent.click(trigger);

    expect(
      await screen.findByRole("heading", { name: "New export profile" }),
    ).toBeTruthy();
    expect(
      document.querySelector(
        '[data-smoke-surface="partner-export-profile-sheet"][data-smoke-ready="partner-export-profile-sheet"]',
      ),
    ).toBeTruthy();
    const sheet = document.querySelector(
      '[data-smoke-surface="partner-export-profile-sheet"]',
    );
    expect(sheet?.className).toContain("data-[side=right]:w-full!");
    expect(sheet?.className).toContain("data-[side=right]:sm:w-2/3!");
    expect(sheet?.className).toContain("data-[side=right]:sm:max-w-none!");
    expect(
      screen.getByText(
        "Dataset name and UTC download timestamp are added automatically.",
      ),
    ).toBeTruthy();
    expect(document.querySelector('input[value="PG_PeopleID3"]')).toBeTruthy();
    expect(
      document.querySelector('input[value="PG_AX_unique_PG_ID_PGIC"]'),
    ).toBeTruthy();
    expect(screen.getByLabelText("Source for PG_PeopleID3")).toHaveProperty(
      "value",
      "pg_peopleid3",
    );
    expect(screen.getByLabelText("Source for PG_ROP3")).toHaveProperty(
      "value",
      "",
    );
  });

  it("previews, generates, polls, and exposes private artifact download links", async () => {
    const profile = createProfile();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.endsWith("/partner-exports") && !init?.method) {
        return Response.json({ profiles: [profile], runs: [] });
      }
      if (url.endsWith("/profile-1/preview")) {
        return Response.json({
          preview: {
            headers: ["PG_PeopleID3"],
            rows: [{ PG_PeopleID3: "00123" }],
            sourceRowCount: 1,
            previewRowCount: 1,
            crosswalk: [],
            validation: {
              errorCount: 0,
              warningCount: 0,
              findings: [],
              truncated: false,
            },
          },
        });
      }
      if (url.endsWith("/profile-1/runs")) {
        return Response.json({ run: createRun("queued") }, { status: 202 });
      }
      if (url.endsWith("/runs/run-1")) {
        return Response.json({ run: createRun("success") });
      }
      throw new Error(`Unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <DatasetPartnerExports
        datasetId="dataset-1"
        sourceColumns={sourceColumns}
      />,
    );
    expect(await screen.findByText("Joshua Project export")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    expect(await screen.findByText("00123")).toBeTruthy();

    const generate = screen.getByRole("button", { name: "Generate CSV" });
    expect(generate).not.toHaveProperty("disabled", true);
    fireEvent.click(generate);

    await waitFor(() => {
      expect(
        screen.getByRole("link", { name: /csv/i }).getAttribute("href"),
      ).toBe(
        "/api/admin/datasets/dataset-1/partner-exports/runs/run-1/download?format=csv",
      );
    });
  });
});
