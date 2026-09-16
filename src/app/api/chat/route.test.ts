import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentIdentity } from "@/lib/auth";
import { orchestratePrivateDataChatTurn } from "@/lib/private-data-chat/orchestrator";
import { PrivateDataChatValueResolutionError } from "@/lib/private-data-chat/value-resolver";
import { maxDuration, POST } from "./route";

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

  it("returns one grounded JSON message when orchestration completes", async () => {
    configureFeature();
    getCurrentIdentityMock.mockResolvedValue(adminIdentity);
    orchestrateMock.mockResolvedValue({
      content: "There are 3 people groups.",
      facts: ["people_group_count: 3"],
      provenance: null,
    });
    const response = await POST(
      request({ messages: [{ role: "user", content: "Count all." }] }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("cache-control")).toContain("private");
    await expect(response.json()).resolves.toEqual({
      type: "message",
      message: {
        content: "There are 3 people groups.",
        facts: ["people_group_count: 3"],
        provenance: null,
      },
    });
    expect(maxDuration).toBe(300);
  });

  it("keeps the HTTP response pending only until orchestration settles", async () => {
    configureFeature();
    getCurrentIdentityMock.mockResolvedValue(adminIdentity);
    let resolveTurn!: (
      value: Awaited<ReturnType<typeof orchestratePrivateDataChatTurn>>,
    ) => void;
    orchestrateMock.mockReturnValue(
      new Promise((resolve) => {
        resolveTurn = resolve;
      }),
    );

    const responsePromise = POST(
      request({ messages: [{ role: "user", content: "Count all." }] }),
    );
    await vi.waitFor(() => expect(orchestrateMock).toHaveBeenCalledOnce());

    resolveTurn({
      content: "There are 3 people groups.",
      facts: [],
      provenance: null,
    });

    const response = await responsePromise;
    await expect(response.json()).resolves.toMatchObject({
      type: "message",
      message: { content: "There are 3 people groups." },
    });
  });

  it("forwards only bounded signed view, turn, and continuation state", async () => {
    configureFeature();
    process.env.PRIVATE_DATA_CHAT_SEMANTIC_CONTEXT_ENABLED = "true";
    process.env.PRIVATE_DATA_CHAT_TURN_STATE_HMAC_KEY = "t".repeat(32);
    process.env.PRIVATE_DATA_CHAT_VIEW_CONTEXT_HMAC_KEY = "v".repeat(32);
    process.env.PRIVATE_DATA_CHAT_CONTINUATION_HMAC_KEY = "c".repeat(32);
    getCurrentIdentityMock.mockResolvedValue(adminIdentity);
    orchestrateMock.mockResolvedValue({
      content: "Next ROP page.",
      facts: [],
      provenance: null,
    });
    const body = {
      conversationId: "20000000-0000-4000-8000-000000000002",
      messages: [{ role: "user", content: "Continue." }],
      turnStateTokens: ["signed-turn"],
      viewContextToken: "signed-view",
      resourceContinuationToken: "signed-continuation",
    };
    const response = await POST(request(body));
    await response.json();
    expect(orchestrateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        identity: adminIdentity,
        ...body,
      }),
    );
  });

  it("returns a retryable bounded JSON error when semantic values are unavailable", async () => {
    configureFeature();
    getCurrentIdentityMock.mockResolvedValue(adminIdentity);
    orchestrateMock.mockRejectedValue(new PrivateDataChatValueResolutionError());

    const response = await POST(
      request({ messages: [{ role: "user", content: "List groups in US." }] }),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      type: "error",
      code: "semantic_resource_unavailable",
      message: "The approved semantic value resource is temporarily unavailable.",
      retryable: true,
    });
  });
});
