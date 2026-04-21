// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DatasetUploadClient } from "./dataset-upload-client";

const fetchMock = vi.fn();
const { parseMock, uploadToSignedUrlMock } = vi.hoisted(() => ({
  parseMock: vi.fn(),
  uploadToSignedUrlMock: vi.fn(),
}));
const { trackAppEventMock } = vi.hoisted(() => ({
  trackAppEventMock: vi.fn(),
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

vi.mock("@/lib/analytics-client", () => ({
  trackAppEvent: trackAppEventMock,
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
    isPublic: true,
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
    tags: [],
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

    const dashboardLink = await screen.findByRole("link", { name: "Dashboard" });

    expect(dashboardLink.getAttribute("href")).toBe("/dashboard#datasets");
    expect(screen.queryByRole("link", { name: "Back to data" })).toBeNull();

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
      };

      expect(init?.method).toBe("POST");
      expect(body.blobPath).toBe("datasets/csv/replacement.csv");
      expect(body.sizeBytes).toBeGreaterThan(0);
      expect(body.columns).toEqual([{ key: "email", label: "Email", sourceIndex: 0 }]);
    });
    expect(trackAppEventMock).toHaveBeenCalledWith(
      "dataset_upload_started",
      expect.objectContaining({
        source_surface: "dataset_upload",
        success: true,
        replace_target_dataset_id: "dataset-1",
      }),
    );
    expect(trackAppEventMock).toHaveBeenCalledWith(
      "dataset_replaced",
      expect.objectContaining({
        source_surface: "dataset_upload",
        success: true,
        dataset_id: "dataset-1",
        replace_target_dataset_id: "dataset-1",
        row_count: 2,
      }),
    );
  });
});
