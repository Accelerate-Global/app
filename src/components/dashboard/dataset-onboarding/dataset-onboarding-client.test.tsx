// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DatasetOnboardingClient } from "./dataset-onboarding-client";

const { parseMock, uploadToSignedUrlMock } = vi.hoisted(() => ({
  parseMock: vi.fn(),
  uploadToSignedUrlMock: vi.fn(),
}));

vi.mock("papaparse", () => ({ default: { parse: parseMock } }));
vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({
    storage: {
      from: () => ({ uploadToSignedUrl: uploadToSignedUrlMock }),
    },
  }),
}));

const serviceAccountEmail = "sheets@app-project.iam.gserviceaccount.com";
const spreadsheetUrl = "https://docs.google.com/spreadsheets/d/sheet_123/edit";

function response(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const connection = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Reviewed People",
  description: "Private Google Sheets tab.",
  method: "GET" as const,
  url: spreadsheetUrl,
  headers: [],
  bodyTemplate: "",
  responseFormat: "csv" as const,
  responseDataPath: "",
  importMode: "create" as const,
  targetDatasetId: null,
  datasetName: "Reviewed-People",
  datasetClassification: "PGIC" as const,
  provider: "google_sheets" as const,
  createdAt: "2026-07-16T00:00:00.000Z",
  updatedAt: "2026-07-16T00:00:00.000Z",
};

const secondConnection = {
  ...connection,
  id: "22222222-2222-4222-8222-222222222222",
  name: "Mission Sheet - Countries",
  datasetName: "Mission Sheet - Countries",
};

function installGoogleFetch(options: {
  confidence?: "high" | "medium";
  failFirstRun?: boolean;
  failSecondFirst?: boolean;
  twoTabs?: boolean;
  expectedWorkflowAssignments?: unknown[];
  expectedDatasetClassification?: "PGIC" | "PGAC";
  expectedDatasetName?: string;
} = {}) {
  const runAttempts = new Map<string, number>();
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/google-sheets/check-access")) {
      return response({
        preview: {
          spreadsheetId: "sheet_123",
          spreadsheetUrl,
          spreadsheetTitle: "Mission Sheet",
          sheets: [
            { sheetId: 1, title: "People", index: 0 },
            ...(options.twoTabs
              ? [{ sheetId: 2, title: "Countries", index: 1 }]
              : []),
          ],
        },
        serviceAccountEmail,
      });
    }
    if (url.endsWith("/google-sheets/header-preview")) {
      const sheetId = JSON.parse(String(init?.body)).sheetId as number;
      const sheetTitle = sheetId === 1 ? "People" : "Countries";
      return response({
        preview: {
          sheetId,
          sheetTitle,
          inspectedRowCount: 3,
          candidates: [
            {
              rowNumber: 2,
              score: 9,
              confidence: options.confidence ?? "high",
              values: sheetId === 1 ? ["People Group", "Country"] : ["Country", "Region"],
            },
          ],
          recommendedRow: 2,
          selected: {
            mode: "auto",
            startRow: 2,
            endRow: 2,
            headers: sheetId === 1 ? ["People Group", "Country"] : ["Country", "Region"],
            fingerprint: "fingerprint",
            confidence: options.confidence ?? "high",
          },
          sampleRows: [["Khmu", "Laos"]],
        },
      });
    }
    if (url.endsWith("/google-sheets/connect")) {
      const body = JSON.parse(String(init?.body));
      if (options.twoTabs) {
        expect(body.selectedSheetIds).toEqual([1, 2]);
      } else {
        expect(body).toMatchObject({
          selectedSheetIds: [1],
          datasetSettings: [{
            sheetId: 1,
            datasetName: options.expectedDatasetName ?? "Reviewed People",
          }],
          datasetClassification: options.expectedDatasetClassification ?? "PGIC",
          isWorkspaceVisible: false,
          workflowAssignments: options.expectedWorkflowAssignments ?? [
            { sheetId: 1, kind: "none" },
          ],
        });
      }
      return response({
        connections: options.twoTabs
          ? [connection, secondConnection]
          : [connection],
      }, 201);
    }
    const matchedConnection = [connection, secondConnection].find((candidate) =>
      url.endsWith(`/${candidate.id}/run`),
    );
    if (matchedConnection) {
      const attempt = (runAttempts.get(matchedConnection.id) ?? 0) + 1;
      runAttempts.set(matchedConnection.id, attempt);
      if (
        (options.failFirstRun && matchedConnection.id === connection.id && attempt === 1) ||
        (options.failSecondFirst &&
          matchedConnection.id === secondConnection.id &&
          attempt === 1)
      ) {
        return response({ error: "Temporary import failure." }, 500);
      }
      return response(
        {
          connection: matchedConnection,
          run: {
            id: `run-${matchedConnection.id}-${attempt}`,
            connectionId: matchedConnection.id,
            actorOwnerId: "admin-1",
            actorEmail: "admin@example.com",
            mode: "import",
            status: "success",
            httpStatus: 200,
            durationMs: 20,
            rowCount: 1,
            datasetId:
              matchedConnection.id === connection.id ? "dataset-1" : "dataset-2",
            errorMessage: null,
            responsePreview: "",
            startedAt: "2026-07-16T00:00:00.000Z",
            completedAt: "2026-07-16T00:00:01.000Z",
            createdAt: "2026-07-16T00:00:00.000Z",
          },
        },
        202,
      );
    }
    throw new Error(`Unexpected fetch ${url} ${init?.method ?? "GET"}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function reachGoogleReview() {
  fireEvent.click(screen.getByRole("button", { name: /Google Sheet/ }));
  fireEvent.change(screen.getByLabelText("Google Sheet link"), {
    target: { value: spreadsheetUrl },
  });
  fireEvent.click(screen.getByRole("button", { name: "Check access" }));
  expect(await screen.findByText("Access confirmed")).toBeTruthy();
  fireEvent.click(screen.getByRole("checkbox", { name: "People" }));
  expect(await screen.findByText("high confidence")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Review dataset details" }));
  fireEvent.change(screen.getByLabelText("Dataset name for People"), {
    target: { value: "Reviewed People" },
  });
  fireEvent.change(screen.getByLabelText("Dataset classification"), {
    target: { value: "PGIC" },
  });
  fireEvent.click(screen.getByRole("radio", { name: /Only administrators/ }));
  expect(screen.getByText("Private")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Review import" }));
}

describe("DatasetOnboardingClient", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    uploadToSignedUrlMock.mockResolvedValue({ data: {}, error: null });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("shows one guided source choice and accessible progress", () => {
    render(<DatasetOnboardingClient serviceAccountEmail={serviceAccountEmail} />);
    expect(screen.getByRole("heading", { name: "Choose a source" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Google Sheet/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /CSV file/ })).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Open Connections" }).getAttribute("href"),
    ).toBe("/dashboard/api-connections");
    expect(document.querySelector('[aria-current="step"]')?.textContent).toContain(
      "Source",
    );
  });

  it("shows the Private tag preview only after administrator-only access is selected", async () => {
    parseMock.mockImplementation((_file: File, options: {
      preview?: number;
      complete?: (result: { data: string[][] }) => void;
    }) => options.complete?.({ data: [["People Group", "Country"]] }));
    render(
      <DatasetOnboardingClient
        serviceAccountEmail={serviceAccountEmail}
        initialSource="csv"
      />,
    );
    fireEvent.change(
      document.querySelector('[data-smoke-upload-input="dataset-onboarding-csv"]')!,
      {
        target: {
          files: [new File(["People Group,Country"], "people.csv")],
        },
      },
    );
    await screen.findByText(/Nothing has been uploaded/);
    fireEvent.click(screen.getByRole("button", { name: "Review dataset details" }));
    expect(document.querySelector("[data-smoke-dataset-private-tag]")).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: /Only administrators/ }));
    expect(document.querySelector("[data-smoke-dataset-private-tag]")).toBeTruthy();
  });

  it("connects, imports, and links a reviewed private Google Sheet dataset", async () => {
    installGoogleFetch();
    render(<DatasetOnboardingClient serviceAccountEmail={serviceAccountEmail} />);
    await reachGoogleReview();
    fireEvent.click(
      screen.getByRole("button", { name: "Connect and import datasets" }),
    );
    const openDataset = await screen.findByRole("link", { name: "Open dataset" });
    expect(openDataset.getAttribute("href")).toBe("/dashboard/datasets/dataset-1");
    expect(screen.getByRole("heading", { name: "Import complete" })).toBeTruthy();
  });

  it("links an Accelerate-managed engagement dataset to the Tier 2 workflow", async () => {
    installGoogleFetch({
      expectedDatasetClassification: "PGAC",
      expectedDatasetName: "Final-58",
      expectedWorkflowAssignments: [
        {
          sheetId: 1,
          kind: "tier2",
          ownerKey: "ax",
          feedKey: "final-58",
          feedName: "Final-58",
          stableRowKeyColumn: "People Group",
          trackingIdColumn: "Country",
          trackingIdSource: "provider-native",
          trackingIdSourceColumn: null,
          trackingIdSourceMappings: [],
          sourceRop3Column: null,
          sourceCountryColumn: null,
          sourceIso3Column: null,
        },
      ],
    });
    render(
      <DatasetOnboardingClient
        serviceAccountEmail={serviceAccountEmail}
        tier2OwnerOptions={[{ key: "ax", label: "Accelerate" }]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Google Sheet/ }));
    fireEvent.change(screen.getByLabelText("Google Sheet link"), {
      target: { value: spreadsheetUrl },
    });
    fireEvent.click(screen.getByRole("button", { name: "Check access" }));
    await screen.findByText("Access confirmed");
    fireEvent.click(screen.getByRole("checkbox", { name: "People" }));
    await screen.findByText("high confidence");
    fireEvent.click(screen.getByRole("button", { name: "Review dataset details" }));
    fireEvent.change(screen.getByLabelText("Workflow for People"), {
      target: { value: "tier2" },
    });
    fireEvent.change(screen.getByLabelText("Dataset owner for People"), {
      target: { value: "ax" },
    });
    fireEvent.change(screen.getByLabelText("Engagement feed name for People"), {
      target: { value: "Final-58" },
    });
    fireEvent.change(screen.getByLabelText("Permanent Tier 2 row ID for People"), {
      target: { value: "People Group" },
    });
    fireEvent.change(screen.getByLabelText("Tracking ID type for People"), {
      target: { value: "provider-native" },
    });
    fireEvent.change(screen.getByLabelText("Tracking ID column for People"), {
      target: { value: "Country" },
    });
    fireEvent.change(screen.getByLabelText("Dataset name for People"), {
      target: { value: "Final-58" },
    });
    fireEvent.click(screen.getByRole("radio", { name: /Only administrators/ }));
    fireEvent.click(screen.getByRole("button", { name: "Review import" }));

    expect(screen.getByText("Tier 2 · Accelerate · Final-58 · provider-native: Country")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Connect and import datasets" }),
    );
    expect(await screen.findByRole("link", { name: "Open dataset" })).toBeTruthy();
  });

  it("retries a failed import without reconnecting", async () => {
    const fetchMock = installGoogleFetch({ failFirstRun: true });
    render(<DatasetOnboardingClient serviceAccountEmail={serviceAccountEmail} />);
    await reachGoogleReview();
    fireEvent.click(
      screen.getByRole("button", { name: "Connect and import datasets" }),
    );
    expect(await screen.findByText("Temporary import failure.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry import" }));
    expect(await screen.findByRole("link", { name: "Open dataset" })).toBeTruthy();
    expect(
      fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/google-sheets/connect")),
    ).toHaveLength(1);
  });

  it("automatically expands ambiguous Google Sheet headers for review", async () => {
    installGoogleFetch({ confidence: "medium" });
    render(<DatasetOnboardingClient serviceAccountEmail={serviceAccountEmail} />);
    fireEvent.click(screen.getByRole("button", { name: /Google Sheet/ }));
    fireEvent.change(screen.getByLabelText("Google Sheet link"), {
      target: { value: spreadsheetUrl },
    });
    fireEvent.click(screen.getByRole("button", { name: "Check access" }));
    await screen.findByText("Access confirmed");
    fireEvent.click(screen.getByRole("checkbox", { name: "People" }));

    expect(await screen.findAllByText("medium confidence")).toHaveLength(2);
    expect(await screen.findByLabelText("Header row for People")).toBeTruthy();
    expect(screen.getByText(/Sheet structure is ambiguous/)).toBeTruthy();
  });

  it("preserves successful Sheet imports while retrying only a failed tab", async () => {
    const fetchMock = installGoogleFetch({ twoTabs: true, failSecondFirst: true });
    render(<DatasetOnboardingClient serviceAccountEmail={serviceAccountEmail} />);
    fireEvent.click(screen.getByRole("button", { name: /Google Sheet/ }));
    fireEvent.change(screen.getByLabelText("Google Sheet link"), {
      target: { value: spreadsheetUrl },
    });
    fireEvent.click(screen.getByRole("button", { name: "Check access" }));
    await screen.findByText("Access confirmed");
    fireEvent.click(screen.getByRole("checkbox", { name: "People" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Countries" }));
    await waitFor(() =>
      expect(screen.getAllByText("high confidence")).toHaveLength(2),
    );
    fireEvent.click(screen.getByRole("button", { name: "Review dataset details" }));
    fireEvent.click(screen.getByRole("button", { name: "Review import" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Connect and import datasets" }),
    );

    expect(await screen.findByText("Temporary import failure.")).toBeTruthy();
    expect(screen.getAllByRole("link", { name: "Open dataset" })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Retry import" }));
    await waitFor(() =>
      expect(screen.getAllByRole("link", { name: "Open dataset" })).toHaveLength(2),
    );
    expect(
      fetchMock.mock.calls.filter(([url]) =>
        String(url).endsWith("/google-sheets/connect"),
      ),
    ).toHaveLength(1);
  });

  it("reviews a CSV locally before uploading with reviewed privacy", async () => {
    parseMock.mockImplementation((_file: File, options: {
      preview?: number;
      complete?: (result: { data: string[][] }) => void;
      chunk?: (result: { data: string[][] }) => void;
    }) => {
      if (options.preview === 1) {
        options.complete?.({ data: [["People Group", "Country"]] });
      } else {
        options.chunk?.({
          data: [["People Group", "Country"], ["Khmu", "Laos"]],
        });
        options.complete?.({ data: [] });
      }
    });
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/blob/upload-token") {
        return response({ bucket: "datasets", path: "datasets/csv/people.csv", token: "token" });
      }
      if (url === "/api/datasets") {
        expect(JSON.parse(String(init?.body))).toMatchObject({
          fileName: "Reviewed CSV",
          classification: "PGAC",
          isWorkspaceVisible: false,
        });
        return response({ dataset: { id: "csv-dataset", fileName: "Reviewed CSV" } }, 201);
      }
      if (url === "/api/datasets/csv-dataset/rows/batch") {
        const body = JSON.parse(String(init?.body));
        return response({
          dataset: {
            id: "csv-dataset",
            fileName: "Reviewed CSV",
            rowCount: body.isFinalBatch ? 1 : 0,
          },
        });
      }
      throw new Error(`Unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <DatasetOnboardingClient
        serviceAccountEmail={serviceAccountEmail}
        initialSource="csv"
      />,
    );
    const file = new File(["People Group,Country\nKhmu,Laos"], "people.csv", {
      type: "text/csv",
    });
    fireEvent.change(
      document.querySelector('[data-smoke-upload-input="dataset-onboarding-csv"]')!,
      { target: { files: [file] } },
    );
    expect(await screen.findByText("Nothing has been uploaded. We found 2 columns in the first row.")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Review dataset details" }));
    fireEvent.change(screen.getByLabelText("Dataset name"), {
      target: { value: "Reviewed CSV" },
    });
    fireEvent.click(screen.getByRole("radio", { name: /Only administrators/ }));
    fireEvent.click(screen.getByRole("button", { name: "Review import" }));
    fireEvent.click(screen.getByRole("button", { name: "Upload dataset" }));
    await waitFor(() => expect(uploadToSignedUrlMock).toHaveBeenCalled());
    expect(await screen.findByRole("link", { name: "Open dataset" })).toBeTruthy();
  });
});
