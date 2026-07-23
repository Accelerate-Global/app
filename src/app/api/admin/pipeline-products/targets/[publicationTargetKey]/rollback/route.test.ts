import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentIdentity } from "@/lib/auth";
import {
  PipelineProductError,
  rollbackPipelineProductTarget,
} from "@/lib/pipeline-products";
import { POST } from "./route";

vi.mock("@/lib/auth", () => ({ getCurrentIdentity: vi.fn() }));
vi.mock("@/lib/pipeline-products", async () => {
  const actual = await vi.importActual<typeof import("@/lib/pipeline-products")>(
    "@/lib/pipeline-products",
  );
  return { ...actual, rollbackPipelineProductTarget: vi.fn() };
});

const identity = {
  ownerId: "admin-1",
  email: "admin@example.com",
  fullName: "Admin",
  workspaceRole: "admin" as const,
  isDatasetAdmin: true,
  mode: "supabase" as const,
};

const context = {
  params: Promise.resolve({ publicationTargetKey: "aggregate1-south-asia" }),
};
const publicationId = "85000000-0000-4000-8000-000000000041";
const expectedCurrentPublicationId = "85000000-0000-4000-8000-000000000042";

describe("/api/admin/pipeline-products/targets/:publicationTargetKey/rollback", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getCurrentIdentity).mockResolvedValue(identity);
    vi.mocked(rollbackPipelineProductTarget).mockResolvedValue({
      definitionKey: "aggregate1-south-asia",
      publicationTargetKey: "aggregate1-south-asia",
      restoredFromPublicationId: publicationId,
      publicationId: "85000000-0000-4000-8000-000000000043",
      runId: "85000000-0000-4000-8000-000000000044",
      datasetId: "85000000-0000-4000-8000-000000000045",
    });
  });

  it("rejects unauthenticated rollback requests", async () => {
    vi.mocked(getCurrentIdentity).mockResolvedValueOnce(null);
    const response = await POST(new Request(
      "http://localhost/api/admin/pipeline-products/targets/aggregate1-south-asia/rollback",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicationId,
          expectedCurrentPublicationId,
          reason: "Restore reviewed publication",
        }),
      },
    ), context);

    expect(response.status).toBe(401);
    expect(rollbackPipelineProductTarget).not.toHaveBeenCalled();
  });

  it("requires the exact retained and current publications", async () => {
    const response = await POST(new Request(
      "http://localhost/api/admin/pipeline-products/targets/aggregate1-south-asia/rollback",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Restore reviewed publication" }),
      },
    ), context);

    expect(response.status).toBe(400);
    expect(rollbackPipelineProductTarget).not.toHaveBeenCalled();
  });

  it("passes the target, exact publications, reason, and actor to rollback", async () => {
    const response = await POST(new Request(
      "http://localhost/api/admin/pipeline-products/targets/aggregate1-south-asia/rollback",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicationId,
          expectedCurrentPublicationId,
          reason: "Restore reviewed publication",
        }),
      },
    ), context);

    expect(response.status).toBe(200);
    expect(rollbackPipelineProductTarget).toHaveBeenCalledWith({
      publicationTargetKey: "aggregate1-south-asia",
      publicationId,
      expectedCurrentPublicationId,
      reason: "Restore reviewed publication",
      actorOwnerId: identity.ownerId,
      actorEmail: identity.email,
    });
  });

  it("preserves rollback conflicts from the service", async () => {
    vi.mocked(rollbackPipelineProductTarget).mockRejectedValueOnce(
      new PipelineProductError("The stable target changed since rollback review.", 409),
    );
    const response = await POST(new Request(
      "http://localhost/api/admin/pipeline-products/targets/aggregate1-south-asia/rollback",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicationId,
          expectedCurrentPublicationId,
          reason: "Restore reviewed publication",
        }),
      },
    ), context);

    expect(response.status).toBe(409);
  });
});
