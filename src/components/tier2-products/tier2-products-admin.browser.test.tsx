// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Tier2AdminOverview } from "@/lib/tier2-products";

import { Tier2ProductsAdmin } from "./tier2-products-admin";

const alphaId = "10000000-0000-4000-8000-000000000001";
const betaId = "10000000-0000-4000-8000-000000000002";
const canaryId = "20000000-0000-4000-8000-000000000001";

function profile(id: string, key: string, name: string) {
  return {
    id,
    profileKey: key,
    partnerKey: key,
    displayName: name,
    apiConnectionId: id,
    spreadsheetId: `${key}-sheet`,
    sheetId: 1,
    sheetTitle: "Engagement",
    stableRowKeyColumn: "Row ID",
    trackingIdColumn: "PeopleID3",
    trackingIdSource: "peopleid3" as const,
    trackingIdSourceColumn: null,
    trackingIdSourceMappings: [],
    sourceRop3Column: null,
    sourceCountryColumn: null,
    sourceIso3Column: null,
    contractVersion: "v1",
    contractChecksum: "a".repeat(64),
    active: true,
    createdByOwnerId: "admin",
    updatedByOwnerId: "admin",
    createdAt: "2026-07-22T00:00:00.000Z",
    updatedAt: "2026-07-22T00:00:00.000Z",
  };
}

const overview = {
  profiles: [profile(alphaId, "alpha", "Alpha"), profile(betaId, "beta", "Beta")],
  resources: [],
  formingRuns: [],
  runs: [],
  targets: [],
  eligiblePublications: [],
  connections: [],
  system: { resourceSet: null, registryRevision: null, defaultRuleBinding: {} },
  tier2Schedules: [
    {
      definitionKey: "tier2-partner",
      sourceProfileId: alphaId,
      enabled: true,
      intervalMinutes: 60,
      manualCanaryRunId: canaryId,
      manualCanaryVerifiedAt: "2026-07-22T00:00:00.000Z",
      manualCanaryVerifiedBy: "admin",
      lastEnqueuedAt: null,
      updatedAt: "2026-07-22T00:00:00.000Z",
    },
    {
      definitionKey: "tier2-partner",
      sourceProfileId: betaId,
      enabled: true,
      intervalMinutes: 120,
      manualCanaryRunId: "20000000-0000-4000-8000-000000000002",
      manualCanaryVerifiedAt: "2026-07-22T00:00:00.000Z",
      manualCanaryVerifiedBy: "admin",
      lastEnqueuedAt: null,
      updatedAt: "2026-07-22T00:00:00.000Z",
    },
  ],
} as unknown as Tier2AdminOverview;

describe("Tier2ProductsAdmin profile schedules", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("renders independent profile states and sends the selected profile with its canary", async () => {
    const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
    vi.stubGlobal("fetch", vi.fn(async (value: string | URL | Request, init?: RequestInit) => {
      const url = String(value);
      if (url.includes("/schedules/")) {
        requests.push({ url, body: JSON.parse(String(init?.body)) as Record<string, unknown> });
        return Response.json({ configured: true });
      }
      return Response.json(overview);
    }));

    render(<Tier2ProductsAdmin initialOverview={overview} />);
    expect(screen.getByText("Every 60m")).toBeTruthy();
    expect(screen.getByText("Every 120m")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Partner profile"), { target: { value: betaId } });
    fireEvent.change(screen.getByLabelText("Successful manual canary run ID"), {
      target: { value: canaryId },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enable schedule" }));

    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0]).toEqual({
      url: "/api/admin/pipeline-operations/schedules/tier2-partner",
      body: {
        sourceProfileId: betaId,
        enabled: true,
        intervalMinutes: 120,
        canaryRunId: canaryId,
      },
    });
  });
});
