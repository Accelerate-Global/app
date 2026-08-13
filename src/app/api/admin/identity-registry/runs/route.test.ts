import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentIdentity } from "@/lib/auth";
import { buildAxIdentityCandidate, listAxIdentityRuns } from "@/lib/identity-registry";
import { snapshotCurrentPipelineInputs } from "@/lib/pipeline-operations";
import { GET, POST } from "./route";

vi.mock("@/lib/auth", () => ({ getCurrentIdentity: vi.fn() }));
vi.mock("@/lib/identity-registry", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/identity-registry")>()),
  buildAxIdentityCandidate: vi.fn(),
  listAxIdentityRuns: vi.fn(),
}));
vi.mock("@/lib/pipeline-operations", () => ({
  snapshotCurrentPipelineInputs: vi.fn(),
}));

const identity = {
  ownerId: "admin-1",
  email: "admin@example.com",
  fullName: "Admin",
  workspaceRole: "admin" as const,
  isDatasetAdmin: true,
  mode: "supabase" as const,
};

describe("/api/admin/identity-registry/runs", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getCurrentIdentity).mockResolvedValue(identity);
    vi.mocked(snapshotCurrentPipelineInputs).mockResolvedValue({
      referenceVersionBindings: {
        "country-territory-codes": {
          versionId: "10000000-0000-4000-8000-000000000001",
          checksum: "a".repeat(64),
        },
        "rop-codes": {
          versionId: "20000000-0000-4000-8000-000000000001",
          checksum: "b".repeat(64),
        },
      },
      registryRevision: {
        registryRevisionId: "30000000-0000-4000-8000-000000000001",
        checksum: "c".repeat(64),
      },
    });
  });

  it("lists candidates", async () => {
    vi.mocked(listAxIdentityRuns).mockResolvedValue([]);
    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ runs: [] });
  });

  it("rejects invalid build payloads", async () => {
    const response = await POST(
      new Request("http://localhost/api/admin/identity-registry/runs", {
        method: "POST",
        body: JSON.stringify({ sourcePublicationId: "not-a-uuid" }),
      }),
    );
    expect(response.status).toBe(400);
    expect(buildAxIdentityCandidate).not.toHaveBeenCalled();
  });

  it("builds from one exact publication", async () => {
    vi.mocked(buildAxIdentityCandidate).mockResolvedValue(null);
    const sourcePublicationId = "00000000-0000-4000-8000-000000000001";
    const response = await POST(
      new Request("http://localhost/api/admin/identity-registry/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourcePublicationId }),
      }),
    );
    expect(response.status).toBe(201);
    expect(buildAxIdentityCandidate).toHaveBeenCalledWith({
      sourcePublicationId,
      countryVersionId: "10000000-0000-4000-8000-000000000001",
      countryChecksum: "a".repeat(64),
      ropVersionId: "20000000-0000-4000-8000-000000000001",
      ropChecksum: "b".repeat(64),
      baseRevisionId: "30000000-0000-4000-8000-000000000001",
      baseRevisionChecksum: "c".repeat(64),
      identity,
    });
  });

  it("rebuilds a reviewed candidate from the same pinned current inputs", async () => {
    vi.mocked(buildAxIdentityCandidate).mockResolvedValue(null);
    const sourcePublicationId = "00000000-0000-4000-8000-000000000001";
    const reviewRunId = "00000000-0000-4000-8000-000000000002";
    const response = await POST(
      new Request("http://localhost/api/admin/identity-registry/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourcePublicationId, reviewRunId }),
      }),
    );
    expect(response.status).toBe(201);
    expect(buildAxIdentityCandidate).toHaveBeenCalledWith(expect.objectContaining({
      sourcePublicationId,
      reviewRunId,
      identity,
    }));
  });

  it("fails closed when an exact registry or resource pin is unavailable", async () => {
    vi.mocked(snapshotCurrentPipelineInputs).mockResolvedValue({
      referenceVersionBindings: {},
      registryRevision: null,
    });
    const response = await POST(
      new Request("http://localhost/api/admin/identity-registry/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourcePublicationId: "00000000-0000-4000-8000-000000000001",
        }),
      }),
    );
    expect(response.status).toBe(409);
    expect(buildAxIdentityCandidate).not.toHaveBeenCalled();
  });
});
