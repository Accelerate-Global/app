import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiConnectionError } from "@/lib/api-connections";
import {
  assignGoogleSheetsConnectionWorkflow,
  getGoogleSheetsConnectionWorkflow,
} from "@/lib/api-connections/workflow-assignments";

import { GET, PUT } from "./route";

vi.mock("@/lib/api-connections/workflow-assignments", () => ({
  assignGoogleSheetsConnectionWorkflow: vi.fn(),
  getGoogleSheetsConnectionWorkflow: vi.fn(),
}));

vi.mock("@/lib/route-guard", () => ({
  withRoute:
    (
      _options: unknown,
      handler: (identity: { ownerId: string }, request: Request, context: unknown) => unknown,
    ) =>
    (request: Request, context: unknown) =>
      handler({ ownerId: "owner-1" }, request, context),
}));

const context = { params: Promise.resolve({ connectionId: "connection-1" }) };
const tier2Assignment = {
  sheetId: 7,
  kind: "tier2" as const,
  ownerKey: "accelerate",
  feedKey: "final-58",
  feedName: "Final-58",
  stableRowKeyColumn: "Record ID",
  trackingIdColumn: "Tracking ID",
  trackingIdSource: "peopleid3" as const,
  trackingIdSourceColumn: null,
  trackingIdSourceMappings: [],
  sourceRop3Column: "ROP3",
  sourceCountryColumn: "Country",
  sourceIso3Column: null,
};

describe("connection workflow assignment route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the active assignment", async () => {
    vi.mocked(getGoogleSheetsConnectionWorkflow).mockResolvedValue(tier2Assignment);
    const response = await GET(new Request("https://example.test"), context);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      assignment: tier2Assignment,
    });
  });

  it("validates and assigns an exact reviewed workflow", async () => {
    vi.mocked(assignGoogleSheetsConnectionWorkflow).mockResolvedValue(
      tier2Assignment,
    );
    const response = await PUT(
      new Request("https://example.test", {
        method: "PUT",
        body: JSON.stringify(tier2Assignment),
      }),
      context,
    );
    expect(response.status).toBe(200);
    expect(assignGoogleSheetsConnectionWorkflow).toHaveBeenCalledWith({
      connectionId: "connection-1",
      actorOwnerId: "owner-1",
      assignment: tier2Assignment,
    });
  });

  it("rejects an unlinked assignment", async () => {
    const response = await PUT(
      new Request("https://example.test", {
        method: "PUT",
        body: JSON.stringify({ sheetId: 7, kind: "none" }),
      }),
      context,
    );
    expect(response.status).toBe(400);
    expect(assignGoogleSheetsConnectionWorkflow).not.toHaveBeenCalled();
  });

  it("returns a safe conflict without exposing provider details", async () => {
    vi.mocked(assignGoogleSheetsConnectionWorkflow).mockRejectedValue(
      new ApiConnectionError("This connection is already linked to a data workflow.", 409),
    );
    const response = await PUT(
      new Request("https://example.test", {
        method: "PUT",
        body: JSON.stringify(tier2Assignment),
      }),
      context,
    );
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "This connection is already linked to a data workflow.",
    });
  });
});
