import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentIdentity } from "@/lib/auth";
import { assignDatasetDerivedView } from "@/lib/datasets";
import { POST } from "./route";

vi.mock("@/lib/auth", () => ({
  getCurrentIdentity: vi.fn(),
}));

vi.mock("@/lib/datasets", () => ({
  DerivedDatasetSourceConflictError: class DerivedDatasetSourceConflictError extends Error {
    readonly status = 409;

    constructor(
      message = "Derived dataset views cannot reference themselves as a backing dataset.",
    ) {
      super(message);
      this.name = "DerivedDatasetSourceConflictError";
    }
  },
  assignDatasetDerivedView: vi.fn(),
}));

const getCurrentIdentityMock = vi.mocked(getCurrentIdentity);
const assignDatasetDerivedViewMock = vi.mocked(assignDatasetDerivedView);

const identity = {
  ownerId: "supabase-user",
  email: "admin@example.com",
  fullName: null,
  isDatasetAdmin: true,
  mode: "supabase" as const,
};

const context = {
  params: Promise.resolve({
    datasetId: "f0000000-0000-4000-8000-000000000001",
  }),
};

const dataset = {
  id: "f0000000-0000-4000-8000-000000000001",
  backingDatasetId: "f0000000-0000-4000-8000-000000000099",
  sortOrder: 0,
  fileName: "South Asia",
  blobUrl: "https://example.supabase.co/storage/v1/object/datasets/datasets/csv/south-asia.csv",
  blobPath: "datasets/csv/south-asia.csv",
  isPrimary: false,
  isPublic: true,
  status: "ready" as const,
  rowCount: 2,
  sizeBytes: 100,
  columns: [{ key: "email", label: "Email", sourceIndex: 0 }],
  hiddenColumnKeys: [],
  defaultFilters: {
    region: {
      enabled: true,
      selectedRegionIds: ["10000000-0000-4000-8000-000000000001"],
      selectedRegionNames: ["South Asia"],
      enabledCountryNames: ["India", "Nepal"],
    },
    country: {
      enabled: false,
      selectedCountryNames: [],
      includeAlternateCountries: false,
    },
    watchlist: {
      enabled: false,
      thresholdEnabled: true,
      threshold: 2,
      engagementPhaseEnabled: true,
      engagementPhaseThreshold: 6,
      evangelicalPopulationBelieversRuleEnabled: true,
      evangelicalPopulationBelieversRule: {
        tiers: [
          {
            minPopulation: 0,
            maxPopulation: null,
            minBelievers: 50,
          },
        ],
      },
      frontierGroupEnabled: true,
      frontierGroupValue: true,
    },
    uupg: {
      enabled: false,
    },
    hotspots: {
      enabled: false,
      metric: "unique_uupgs" as const,
      countryCount: 10,
    },
    sorting: [],
  },
  tags: [],
  error: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const payload = {
  sourceDatasetId: "f0000000-0000-4000-8000-000000000099",
  filters: dataset.defaultFilters,
};

describe("/api/datasets/[datasetId]/assign-derived-view", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getCurrentIdentityMock.mockResolvedValue(identity);
  });

  it("rejects unauthenticated assignment requests", async () => {
    getCurrentIdentityMock.mockResolvedValue(null);

    const response = await POST(
      new Request("http://localhost/api/datasets/f0000000-0000-4000-8000-000000000001/assign-derived-view", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
      context,
    );

    expect(response.status).toBe(401);
    expect(assignDatasetDerivedViewMock).not.toHaveBeenCalled();
  });

  it("rejects assignments for non-admin users", async () => {
    getCurrentIdentityMock.mockResolvedValue({
      ...identity,
      isDatasetAdmin: false,
    });

    const response = await POST(
      new Request("http://localhost/api/datasets/f0000000-0000-4000-8000-000000000001/assign-derived-view", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
      context,
    );

    expect(response.status).toBe(403);
    expect(assignDatasetDerivedViewMock).not.toHaveBeenCalled();
  });

  it("rejects invalid payloads", async () => {
    const response = await POST(
      new Request("http://localhost/api/datasets/f0000000-0000-4000-8000-000000000001/assign-derived-view", {
        method: "POST",
        body: JSON.stringify({ sourceDatasetId: "bad-id" }),
      }),
      context,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Dataset assignment payload is invalid.",
    });
    expect(assignDatasetDerivedViewMock).not.toHaveBeenCalled();
  });

  it("assigns a filtered view through the admin-only dataset helper", async () => {
    assignDatasetDerivedViewMock.mockResolvedValue(dataset);

    const response = await POST(
      new Request("http://localhost/api/datasets/f0000000-0000-4000-8000-000000000001/assign-derived-view", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
      context,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ dataset });
    expect(assignDatasetDerivedViewMock).toHaveBeenCalledWith({
      datasetId: "f0000000-0000-4000-8000-000000000001",
      sourceDatasetId: "f0000000-0000-4000-8000-000000000099",
      filters: payload.filters,
    });
  });

  it("returns not found when the target or source dataset does not exist", async () => {
    assignDatasetDerivedViewMock.mockResolvedValue(null);

    const response = await POST(
      new Request("http://localhost/api/datasets/f0000000-0000-4000-8000-000000000001/assign-derived-view", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
      context,
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "Dataset not found.",
    });
  });

  it("returns self-backing conflicts from the dataset helper", async () => {
    const { DerivedDatasetSourceConflictError } = await import("@/lib/datasets");
    assignDatasetDerivedViewMock.mockRejectedValue(
      new DerivedDatasetSourceConflictError(),
    );

    const response = await POST(
      new Request("http://localhost/api/datasets/f0000000-0000-4000-8000-000000000001/assign-derived-view", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
      context,
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error:
        "Derived dataset views cannot reference themselves as a backing dataset.",
    });
  });
});
