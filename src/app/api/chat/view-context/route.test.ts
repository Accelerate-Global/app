import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentIdentity } from "@/lib/auth";
import {
  getPrivateDataChatCurrentPrimaryDatasetVersion,
  verifyPrivateDataChatViewContextToken,
} from "@/lib/private-data-chat/view-context";

import { POST } from "./route";

vi.mock("@/lib/auth", () => ({ getCurrentIdentity: vi.fn() }));
vi.mock("@/lib/error-logging", () => ({ logError: vi.fn() }));
vi.mock("@/lib/private-data-chat/config", () => ({
  getPrivateDataChatConfiguration: () => ({
    enabled: true,
    semanticContextEnabled: true,
    canaryEmails: ["blake@risencode.org"],
    analyticsDatabaseUrl: "postgres://example",
    auditHmacKey: "a".repeat(32),
    turnStateHmacKey: "b".repeat(32),
    viewContextHmacKey: "c".repeat(32),
    continuationHmacKey: "d".repeat(32),
    qwenGatewayUrl: null,
    qwenGatewayHmacKey: null,
    cloudflareAccessClientId: null,
    cloudflareAccessClientSecret: null,
    useFakeQwen: true,
    ready: true,
  }),
}));
vi.mock("@/lib/private-data-chat/view-context", async (original) => ({
  ...(await original<typeof import("@/lib/private-data-chat/view-context")>()),
  getPrivateDataChatCurrentPrimaryDatasetVersion: vi.fn(),
}));

const datasetId = "10000000-0000-4000-8000-000000000001";
const filters = {
  region: { enabled: false, selectedRegionIds: [], selectedRegionNames: [], enabledCountryNames: [] },
  country: { enabled: true, selectedCountryNames: ["Sudan"], includeAlternateCountries: false },
  watchlist: { enabled: false, threshold: 2, engagementPhaseThreshold: 3 },
  uupg: { enabled: true, globalEngagementAnywhereEnabled: true, frontierGroupEnabled: true },
  hotspots: { enabled: false, metric: "unique_uupgs", countryCount: 10 },
  sorting: [],
};

describe("private data chat view-context route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getCurrentIdentity).mockResolvedValue({
      ownerId: "owner-1",
      email: "blake@risencode.org",
      fullName: null,
      workspaceRole: "admin",
      isDatasetAdmin: true,
      mode: "supabase",
    });
    vi.mocked(getPrivateDataChatCurrentPrimaryDatasetVersion).mockResolvedValue({
      id: datasetId,
      versionCreatedAt: "2026-08-31T12:00:00.000Z",
    });
  });

  it("returns a same-origin session token and server-generated summary without accepting a count", async () => {
    const response = await POST(
      new Request("http://localhost/api/chat/view-context", {
        method: "POST",
        body: JSON.stringify({
          datasetId,
          conversationId: "20000000-0000-4000-8000-000000000002",
          filters,
          recordCount: 104,
        }),
      }),
    );
    expect(response.status).toBe(400);

    const valid = await POST(
      new Request("http://localhost/api/chat/view-context", {
        method: "POST",
        body: JSON.stringify({
          datasetId,
          conversationId: "20000000-0000-4000-8000-000000000002",
          filters,
        }),
      }),
    );
    expect(valid.status).toBe(200);
    const payload = await valid.json();
    expect(payload.token).toMatch(/^v1\./u);
    expect(payload.summary.chips).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Sudan" }),
        expect.objectContaining({ label: "UUPG" }),
      ]),
    );
    const signedContext = verifyPrivateDataChatViewContextToken({
      token: payload.token,
      ownerId: "owner-1",
      conversationId: "20000000-0000-4000-8000-000000000002",
      key: "c".repeat(32),
      currentDataset: {
        id: datasetId,
        versionCreatedAt: "2026-08-31T12:00:00.000Z",
      },
    });
    expect(signedContext).not.toHaveProperty("recordCount");
    expect(signedContext.summary).not.toHaveProperty("recordCount");
    expect(signedContext.summary).not.toHaveProperty("count");
  });

  it("rejects a non-primary or stale dataset identity", async () => {
    const response = await POST(
      new Request("http://localhost/api/chat/view-context", {
        method: "POST",
        body: JSON.stringify({
          datasetId: "30000000-0000-4000-8000-000000000003",
          conversationId: "20000000-0000-4000-8000-000000000002",
          filters,
        }),
      }),
    );
    expect(response.status).toBe(409);
  });
});
