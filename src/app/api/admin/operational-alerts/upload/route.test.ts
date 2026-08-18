import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentIdentity } from "@/lib/auth";
import { captureOperationalEvent } from "@/lib/operational-alert-capture";
import { POST } from "./route";

vi.mock("@/lib/auth", () => ({ getCurrentIdentity: vi.fn() }));
vi.mock("@/lib/operational-alert-capture", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/operational-alert-capture")>()),
  captureOperationalEvent: vi.fn(),
}));

const getCurrentIdentityMock = vi.mocked(getCurrentIdentity);
const captureOperationalEventMock = vi.mocked(captureOperationalEvent);
const identity = {
  ownerId: "admin-1",
  email: "admin@example.com",
  fullName: "Admin",
  workspaceRole: "admin" as const,
  isDatasetAdmin: true,
  mode: "supabase" as const,
};

function request(body: unknown) {
  return new Request(
    "https://data.accelerateglobal.org/api/admin/operational-alerts/upload",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://data.accelerateglobal.org",
      },
      body: JSON.stringify(body),
    },
  );
}

describe("POST /api/admin/operational-alerts/upload", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getCurrentIdentityMock.mockResolvedValue(identity);
    captureOperationalEventMock.mockResolvedValue({ queued: true });
  });

  it("accepts one fixed upload stage from an administrator", async () => {
    const response = await POST(
      request({
        operationId: "11111111-1111-4111-8111-111111111111",
        stage: "storage-transfer",
      }),
    );

    expect(response.status).toBe(202);
    expect(captureOperationalEventMock).toHaveBeenCalledWith({
      kind: "dataset-upload-failed",
      operationId: "11111111-1111-4111-8111-111111111111",
      stage: "storage-transfer",
    });
  });

  it("rejects arbitrary stages and alert content", async () => {
    const response = await POST(
      request({
        operationId: "11111111-1111-4111-8111-111111111111",
        stage: "send-secrets",
        summary: "arbitrary HTML <script>",
      }),
    );

    expect(response.status).toBe(400);
    expect(captureOperationalEventMock).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated reporters", async () => {
    getCurrentIdentityMock.mockResolvedValue(null);

    const response = await POST(
      request({
        operationId: "11111111-1111-4111-8111-111111111111",
        stage: "parsing",
      }),
    );

    expect(response.status).toBe(401);
    expect(captureOperationalEventMock).not.toHaveBeenCalled();
  });
});
