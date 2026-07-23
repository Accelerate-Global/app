import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentIdentity } from "@/lib/auth";
import { configurePipelineSchedule } from "@/lib/pipeline-operations";

import { PATCH } from "./route";

vi.mock("@/lib/auth", () => ({ getCurrentIdentity: vi.fn() }));
vi.mock("@/lib/error-logging", () => ({ logError: vi.fn() }));
vi.mock("@/lib/pipeline-operations", async () => {
  const [{ pipelineScheduleSchema }, { isPipelineOperationError }] = await Promise.all([
    import("@/lib/pipeline-operations/schemas"),
    import("@/lib/pipeline-operations/errors"),
  ]);
  return {
    configurePipelineSchedule: vi.fn(),
    isPipelineOperationError,
    pipelineScheduleSchema,
  };
});

const profileId = "91000000-0000-4000-8000-000000000001";
const canaryRunId = "92000000-0000-4000-8000-000000000001";

describe("profile-aware pipeline schedule API", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getCurrentIdentity).mockResolvedValue({
      ownerId: "admin-1",
      email: "admin@example.com",
      fullName: "Admin",
      workspaceRole: "admin",
      isDatasetAdmin: true,
      mode: "supabase",
    });
    vi.mocked(configurePipelineSchedule).mockResolvedValue(undefined);
  });

  it("forwards the exact Tier 2 profile with its canary", async () => {
    const response = await PATCH(
      new Request("http://localhost/api/admin/pipeline-operations/schedules/tier2-partner", {
        method: "PATCH",
        body: JSON.stringify({
          enabled: true,
          intervalMinutes: 1440,
          canaryRunId,
          sourceProfileId: profileId,
        }),
      }),
      { params: Promise.resolve({ definitionKey: "tier2-partner" }) },
    );

    expect(response.status).toBe(200);
    expect(configurePipelineSchedule).toHaveBeenCalledWith({
      definitionKey: "tier2-partner",
      actorOwnerId: "admin-1",
      enabled: true,
      intervalMinutes: 1440,
      canaryRunId,
      sourceProfileId: profileId,
    });
    await expect(response.json()).resolves.toEqual({
      configured: true,
      definitionKey: "tier2-partner",
      sourceProfileId: profileId,
    });
  });

  it("rejects malformed profile identity before repository access", async () => {
    const response = await PATCH(
      new Request("http://localhost/api/admin/pipeline-operations/schedules/tier2-partner", {
        method: "PATCH",
        body: JSON.stringify({
          enabled: true,
          intervalMinutes: 1440,
          canaryRunId,
          sourceProfileId: "not-a-uuid",
        }),
      }),
      { params: Promise.resolve({ definitionKey: "tier2-partner" }) },
    );

    expect(response.status).toBe(400);
    expect(configurePipelineSchedule).not.toHaveBeenCalled();
  });
});
