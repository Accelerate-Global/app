// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DatasetUploadClient } from "./dataset-upload-client";

const fetchMock = vi.fn();
const { parseMock, uploadToSignedUrlMock } = vi.hoisted(() => ({
  parseMock: vi.fn(),
  uploadToSignedUrlMock: vi.fn(),
}));
vi.mock("papaparse", () => ({
  default: {
    parse: parseMock,
  },
}));

vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({
    storage: {
      from: () => ({
        uploadToSignedUrl: uploadToSignedUrlMock,
      }),
    },
  }),
}));

type ParseOptions = {
  preview?: number;
  complete?: (result: { data: string[][] }) => void;
  chunk?: (result: { data: string[][] }) => void;
};

function buildJsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function createTargetDataset() {
  return {
    id: "dataset-1",
    backingDatasetId: null,
    sortOrder: 0,
    fileName: "Global.csv",
    blobUrl: "https://example.com/global.csv",
    blobPath: "datasets/global.csv",
    isPrimary: true,
    isWorkspaceVisible: true,
    status: "ready" as const,
    rowCount: 128,
    sizeBytes: 4096,
    columns: [
      {
        key: "email",
        label: "Email",
        sourceIndex: 0,
      },
    ],
    hiddenColumnKeys: [],
    defaultFilters: null,
    tags: [
      {
        id: "dataset-classification-pgac",
        label: "PGAC",
        color: "#fcab2a",
      },
    ],
    error: null,
    createdAt: new Date("2026-04-15T16:00:00.000Z").toISOString(),
    updatedAt: new Date("2026-04-15T16:00:00.000Z").toISOString(),
  };
}

describe("DatasetUploadClient", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal("fetch", fetchMock);
    uploadToSignedUrlMock.mockResolvedValue({ data: {}, error: null });
    parseMock.mockImplementation((_file: File, options: ParseOptions) => {
      if (options.preview === 1) {
        options.complete?.({ data: [["Email"]] });
        return;
      }

      options.chunk?.({
        data: [["Email"], ["ada@example.com"], ["grace@example.com"]],
      });
      options.complete?.({ data: [] });
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    cleanup();
  });

  it("blocks uploads until PGAC or PGIC is selected for new datasets", async () => {
    render(<DatasetUploadClient />);

    const input = document.querySelector(
      '[data-smoke-upload-input="dataset-upload"]',
    ) as HTMLInputElement | null;

    expect(input).toBeTruthy();

    fireEvent.change(input!, {
      target: {
        files: [new File(["Email\nada@example.com"], "upload.csv", { type: "text/csv" })],
      },
    });

    expect(await screen.findByText("Dataset update failed")).toBeTruthy();
    expect(
      await screen.findAllByText("Choose PGAC or PGIC before uploading a dataset."),
    ).toHaveLength(1);
    expect(document.querySelector("[data-smoke-dataset-ingestion-progress]")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("requires a classification when replacing a derived dataset view", async () => {
    render(
      <DatasetUploadClient
        targetDataset={{
          ...createTargetDataset(),
          backingDatasetId: "dataset-source-1",
          tags: [
            {
              id: "tag-watchlist",
              label: "Watchlist",
              color: "#262531",
            },
          ],
        }}
      />,
    );

    const input = document.querySelector(
      '[data-smoke-upload-input="dataset-upload"]',
    ) as HTMLInputElement | null;

    fireEvent.change(input!, {
      target: {
        files: [new File(["Email\nada@example.com"], "replacement.csv", {
          type: "text/csv",
        })],
      },
    });

    expect(await screen.findByText("Dataset update failed")).toBeTruthy();
    expect(
      await screen.findAllByText("Choose PGAC or PGIC before uploading a dataset."),
    ).toHaveLength(1);
    expect(document.querySelector("[data-smoke-dataset-ingestion-progress]")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows the Dashboard completion CTA after a successful replacement", async () => {
    const targetDataset = createTargetDataset();
    const completedDataset = {
      ...targetDataset,
      blobUrl: "https://example.com/replacement.csv",
      blobPath: "datasets/csv/replacement.csv",
      updatedAt: new Date("2026-04-17T16:00:00.000Z").toISOString(),
    };

    fetchMock.mockImplementation(async (input, init) => {
      if (input === "/api/blob/upload-token" && init?.method === "POST") {
        return buildJsonResponse({
          bucket: "datasets",
          path: "datasets/csv/replacement.csv",
          token: "signed-upload-token",
        });
      }

      if (input === "/api/datasets/dataset-1/replace" && init?.method === "POST") {
        return buildJsonResponse({
          dataset: {
            ...completedDataset,
            status: "processing",
            rowCount: 0,
          },
        });
      }

      if (input === "/api/datasets/dataset-1/rows/batch" && init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as {
          isFinalBatch?: boolean;
        };

        return buildJsonResponse({
          dataset: {
            ...completedDataset,
            status: body.isFinalBatch ? "ready" : "processing",
            rowCount: body.isFinalBatch ? 2 : 0,
          },
        });
      }

      throw new Error(`Unexpected fetch: ${String(input)} ${init?.method ?? "GET"}`);
    });

    let resolveUpload!: (result: { data: object; error: null }) => void;
    uploadToSignedUrlMock.mockReturnValue(
      new Promise((resolve) => {
        resolveUpload = resolve;
      }),
    );

    render(<DatasetUploadClient targetDataset={targetDataset} />);

    const input = document.querySelector(
      '[data-smoke-upload-input="dataset-upload"]',
    ) as HTMLInputElement | null;

    expect(input).toBeTruthy();

    fireEvent.change(input!, {
      target: {
        files: [new File(["Email\nada@example.com\ngrace@example.com"], "replacement.csv", {
          type: "text/csv",
        })],
      },
    });

    expect(await screen.findByText("Uploading replacement for Global.csv")).toBeTruthy();
    const activeProgress = screen.getByRole("progressbar", {
      name: "Global.csv ingestion",
    });
    expect(activeProgress.getAttribute("aria-valuenow")).toBe("35");
    expect(document.querySelector("[data-smoke-dataset-ingestion-progress]")).toBeTruthy();

    await act(async () => {
      resolveUpload({ data: {}, error: null });
    });

    const dashboardLink = await screen.findByRole("link", { name: "Dashboard" });

    expect(dashboardLink.getAttribute("href")).toBe("/dashboard#datasets");
    expect(screen.queryByRole("link", { name: "Back to data" })).toBeNull();
    expect(document.querySelector("[data-smoke-dataset-ingestion-progress]")).toBeNull();

    await waitFor(() => {
      const replaceCall = fetchMock.mock.calls.find(
        ([input]) => input === "/api/datasets/dataset-1/replace",
      );

      expect(replaceCall).toBeTruthy();
      const [, init] = replaceCall ?? [];
      const body = JSON.parse(String(init?.body)) as {
        blobPath: string;
        sizeBytes: number;
        columns: Array<{ key: string; label: string; sourceIndex: number }>;
        classification: string;
      };

      expect(init?.method).toBe("POST");
      expect(body.blobPath).toBe("datasets/csv/replacement.csv");
      expect(body.sizeBytes).toBeGreaterThan(0);
      expect(body.columns).toEqual([{ key: "email", label: "Email", sourceIndex: 0 }]);
      expect(body.classification).toBe("PGAC");
    });
  });
});
