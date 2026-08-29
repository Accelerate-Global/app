import { createHash, createHmac } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  HttpPrivateQwenGateway,
  PrivateQwenGatewayError,
  signPrivateQwenGatewayRequest,
} from "@/lib/private-data-chat/qwen-gateway";

const originalEnvironment = { ...process.env };

describe("private Qwen gateway", () => {
  beforeEach(() => {
    process.env.PRIVATE_QWEN_GATEWAY_URL = "https://qwen.example.test";
    process.env.PRIVATE_QWEN_GATEWAY_HMAC_KEY = "h".repeat(32);
    process.env.PRIVATE_QWEN_CF_ACCESS_CLIENT_ID = "client-id";
    process.env.PRIVATE_QWEN_CF_ACCESS_CLIENT_SECRET = "client-secret";
  });

  afterEach(() => {
    process.env = { ...originalEnvironment };
    vi.restoreAllMocks();
  });

  it("creates the canonical body-bound HMAC", () => {
    const input = {
      method: "POST",
      path: "/v1/private-data-chat/plan",
      timestamp: "1000",
      nonce: "nonce",
      body: '{"safe":true}',
      key: "k".repeat(32),
    };
    const digest = createHash("sha256").update(input.body).digest("hex");
    const expected = createHmac("sha256", input.key)
      .update([input.method, input.path, input.timestamp, input.nonce, digest].join("\n"))
      .digest("hex");

    expect(signPrivateQwenGatewayRequest(input)).toBe(`v1=${expected}`);
  });

  it("sends machine authentication and parses a schema-valid plan", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          decision: "clarify",
          question: "Which country?",
          reason: "Country is required.",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const gateway = new HttpPrivateQwenGateway(fetcher);
    const plan = await gateway.plan({
      messages: [{ role: "user", content: "Show the groups there." }],
    });

    expect(plan.decision).toBe("clarify");
    const [, request] = fetcher.mock.calls[0] as [URL, RequestInit];
    const headers = new Headers(request.headers);
    expect(headers.get("CF-Access-Client-Id")).toBe("client-id");
    expect(headers.get("CF-Access-Client-Secret")).toBe("client-secret");
    expect(headers.get("X-AG-Signature")).toMatch(/^v1=[0-9a-f]{64}$/);
    expect(String(request.body)).not.toContain("auth.users");
  });

  it("normalizes busy and invalid response failures", async () => {
    const busy = new HttpPrivateQwenGateway(
      vi.fn().mockResolvedValue(new Response("", { status: 429 })),
    );
    await expect(
      busy.plan({ messages: [{ role: "user", content: "Count all." }] }),
    ).rejects.toMatchObject({ code: "busy", retryable: true });

    const invalid = new HttpPrivateQwenGateway(
      vi.fn().mockResolvedValue(new Response("not-json", { status: 200 })),
    );
    await expect(
      invalid.plan({ messages: [{ role: "user", content: "Count all." }] }),
    ).rejects.toBeInstanceOf(PrivateQwenGatewayError);
  });

  it("normalizes unavailable, deadline, and caller cancellation failures", async () => {
    const unavailable = new HttpPrivateQwenGateway(
      vi.fn().mockResolvedValue(new Response("", { status: 503 })),
    );
    await expect(
      unavailable.plan({ messages: [{ role: "user", content: "Count all." }] }),
    ).rejects.toMatchObject({ code: "unavailable", retryable: true });

    const abortingFetch = vi.fn((_: URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => reject(new DOMException("Aborted", "AbortError")),
          { once: true },
        );
      }),
    ) as unknown as typeof fetch;
    const deadline = new HttpPrivateQwenGateway(abortingFetch, 5);
    await expect(
      deadline.plan({ messages: [{ role: "user", content: "Count all." }] }),
    ).rejects.toMatchObject({ code: "timeout", retryable: true });

    const controller = new AbortController();
    const cancelled = new HttpPrivateQwenGateway(abortingFetch, 1_000);
    const request = cancelled.plan({
      messages: [{ role: "user", content: "Count all." }],
      signal: controller.signal,
    });
    controller.abort("cancelled-by-user");
    await expect(request).rejects.toMatchObject({
      code: "unavailable",
      retryable: false,
    });
  });
});
