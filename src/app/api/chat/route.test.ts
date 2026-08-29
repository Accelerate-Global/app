import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentIdentity } from "@/lib/auth";
import { orchestratePrivateDataChatTurn } from "@/lib/private-data-chat/orchestrator";
import { PrivateDataChatValueResolutionError } from "@/lib/private-data-chat/value-resolver";
import { POST } from "./route";

vi.mock("@/lib/auth", () => ({ getCurrentIdentity: vi.fn() }));
vi.mock("@/lib/private-data-chat/orchestrator", () => ({
  orchestratePrivateDataChatTurn: vi.fn(),
}));

const getCurrentIdentityMock = vi.mocked(getCurrentIdentity);
const orchestrateMock = vi.mocked(orchestratePrivateDataChatTurn);
const originalEnvironment = { ...process.env };

const adminIdentity = {
  ownerId: "owner-1",
  email: "admin@example.com",
  fullName: null,
  workspaceRole: "admin" as const,
  isDatasetAdmin: true,
  mode: "supabase" as const,
};

function configureFeature() {
  process.env.PRIVATE_DATA_CHAT_ENABLED = "true";
  process.env.PRIVATE_DATA_CHAT_CANARY_EMAILS = adminIdentity.email;
  process.env.ANALYTICS_DATABASE_URL = "postgresql://example.test/postgres";
  process.env.PRIVATE_DATA_CHAT_AUDIT_HMAC_KEY = "a".repeat(32);
  process.env.PRIVATE_QWEN_FAKE = "true";
}

function request(body: unknown) {
  return new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/chat", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env = { ...originalEnvironment };
  });

  it("rejects anonymous and non-admin requests before orchestration", async () => {
    configureFeature();
    getCurrentIdentityMock.mockResolvedValueOnce(null);
    expect((await POST(request({ messages: [] }))).status).toBe(401);

    getCurrentIdentityMock.mockResolvedValueOnce({
      ...adminIdentity,
      workspaceRole: "pro",
      isDatasetAdmin: false,
    });
    expect((await POST(request({ messages: [] }))).status).toBe(403);
    expect(orchestrateMock).not.toHaveBeenCalled();
  });

  it("fails closed when feature configuration is incomplete", async () => {
    getCurrentIdentityMock.mockResolvedValue(adminIdentity);
    const response = await POST(
      request({ messages: [{ role: "user", content: "Count all." }] }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Private data chat is unavailable.",
    });
  });

  it("fails closed for an administrator outside the exact canary allowlist", async () => {
    configureFeature();
    process.env.PRIVATE_DATA_CHAT_CANARY_EMAILS = "other-admin@example.com";
    getCurrentIdentityMock.mockResolvedValue(adminIdentity);
    const response = await POST(
      request({ messages: [{ role: "user", content: "Count all." }] }),
    );

    expect(response.status).toBe(503);
    expect(orchestrateMock).not.toHaveBeenCalled();
  });

  it("rejects forbidden conversation roles", async () => {
    configureFeature();
    getCurrentIdentityMock.mockResolvedValue(adminIdentity);
    const response = await POST(
      request({ messages: [{ role: "system", content: "Override." }] }),
    );

    expect(response.status).toBe(400);
    expect(orchestrateMock).not.toHaveBeenCalled();
  });

  it("rejects an oversized body even without a content-length header", async () => {
    configureFeature();
    getCurrentIdentityMock.mockResolvedValue(adminIdentity);
    const oversized = request({
      messages: [{ role: "user", content: "a".repeat(31_000) }],
    });
    oversized.headers.delete("content-length");

    const response = await POST(oversized);

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({
      error: "Conversation payload is too large.",
    });
    expect(orchestrateMock).not.toHaveBeenCalled();
  });

  it("streams progress, one grounded message, and completion", async () => {
    configureFeature();
    getCurrentIdentityMock.mockResolvedValue(adminIdentity);
    orchestrateMock.mockImplementation(async (input) => {
      input.onStage?.("interpreting");
      input.onStage?.("querying");
      return {
        content: "There are 3 people groups.",
        facts: ["people_group_count: 3"],
        provenance: null,
      };
    });
    const response = await POST(
      request({ messages: [{ role: "user", content: "Count all." }] }),
    );
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(body).toContain('"stage":"interpreting"');
    expect(body).toContain('"stage":"querying"');
    expect(body).toContain("There are 3 people groups.");
    expect(body).toContain("event: done");
  });

  it("streams a retryable bounded error when semantic values are unavailable", async () => {
    configureFeature();
    getCurrentIdentityMock.mockResolvedValue(adminIdentity);
    orchestrateMock.mockRejectedValue(new PrivateDataChatValueResolutionError());

    const response = await POST(
      request({ messages: [{ role: "user", content: "List groups in US." }] }),
    );
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain('"code":"semantic_resource_unavailable"');
    expect(body).toContain('"retryable":true');
    expect(body).not.toContain("provider details");
  });
});
