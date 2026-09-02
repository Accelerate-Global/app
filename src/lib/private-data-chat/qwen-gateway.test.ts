import { createHash, createHmac } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  PRIVATE_DATA_CHAT_CATALOG_VERSION,
  getPrivateDataChatAnswerSemanticContext,
} from "@/lib/private-data-chat/catalog";
import {
  HttpPrivateQwenGateway,
  PRIVATE_QWEN_GATEWAY_TIMEOUT_MS,
  PrivateQwenGatewayError,
  signPrivateQwenGatewayRequest,
} from "@/lib/private-data-chat/qwen-gateway";
import {
  PRIVATE_DATA_CHAT_RUNTIME_CONTRACT,
  PRIVATE_DATA_CHAT_RUNTIME_CONTRACT_CHECKSUM,
} from "@/lib/private-data-chat/runtime-contract";

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
      trustedTurnState: [{ selectedConcepts: ["country"] }] as never,
      trustedCurrentView: { filters: [{ field: "country" }] } as never,
      semanticContext: {
        status: "ready",
        items: [{ stableKey: "field.country" }],
      } as never,
    });

    expect(plan.decision).toBe("clarify");
    const [, request] = fetcher.mock.calls[0] as [URL, RequestInit];
    const headers = new Headers(request.headers);
    expect(headers.get("CF-Access-Client-Id")).toBe("client-id");
    expect(headers.get("CF-Access-Client-Secret")).toBe("client-secret");
    expect(headers.get("X-AG-Signature")).toMatch(/^v1=[0-9a-f]{64}$/);
    expect(String(request.body)).not.toContain("auth.users");
    const body = JSON.parse(String(request.body)) as Record<string, unknown>;
    expect(String(body.systemPrompt)).toContain(PRIVATE_DATA_CHAT_CATALOG_VERSION);
    expect(String(body.systemPrompt)).toContain("One row per current primary");
    expect(String(body.systemPrompt)).not.toContain(
      "analytics_ro.primary_people_groups",
    );
    expect(String(body.systemPrompt)).not.toContain("count(*)");
    expect(body).toMatchObject({
      runtimeContract: PRIVATE_DATA_CHAT_RUNTIME_CONTRACT,
      runtimeContractChecksum: PRIVATE_DATA_CHAT_RUNTIME_CONTRACT_CHECKSUM,
      trustedTurnState: [{ selectedConcepts: ["country"] }],
      trustedCurrentView: { filters: [{ field: "country" }] },
      semanticContext: {
        status: "ready",
        items: [{ stableKey: "field.country" }],
      },
    });
  });

  it("sends only selected safe semantic definitions with grounded results", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          answer: "India has a total population of 4,000 people.",
          facts: ["country: India", "total_population: 4000"],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const gateway = new HttpPrivateQwenGateway(fetcher);
    await gateway.answer({
      question: "What is India's total population?",
      semanticContext: getPrivateDataChatAnswerSemanticContext([
        "country",
        "total_population",
      ]),
      retrievedSemanticContext: {
        status: "ready",
        items: [{ stableKey: "result.matched_count" }],
      } as never,
      result: {
        mode: "aggregate",
        requestedLimit: 1,
        returnedCount: 1,
        matchingCount: 1,
        hasMore: false,
        selectedConcepts: ["country", "total_population"],
        appliedNamedFilters: [],
        rows: [{ country: "India", total_population: "4000" }],
        provenance: {
          queryId: "8a000001-1337-403d-8eb5-b7c44a1be131",
          catalogVersion: PRIVATE_DATA_CHAT_CATALOG_VERSION,
          dataset: "primary_people_groups",
          datasetId: null,
          datasetVersionCreatedAt: null,
          rowCount: 1,
          filters: [],
        },
      },
    });

    const [, request] = fetcher.mock.calls[0] as [URL, RequestInit];
    const body = JSON.parse(String(request.body)) as Record<string, unknown>;
    const serialized = JSON.stringify(body.semanticContext);
    expect(serialized).toContain("total_population");
    expect(serialized).toContain("people");
    expect(serialized).not.toContain("average_percent_evangelical");
    expect(serialized).not.toContain("analytics_ro");
    expect(serialized).not.toContain("sum(p.population)");
    expect(body.retrievedSemanticContext).toMatchObject({
      status: "ready",
      items: [{ stableKey: "result.matched_count" }],
    });
    expect(body.runtimeContract).toEqual(PRIVATE_DATA_CHAT_RUNTIME_CONTRACT);
    expect(body.runtimeContractChecksum).toBe(
      PRIVATE_DATA_CHAT_RUNTIME_CONTRACT_CHECKSUM,
    );
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
    expect(PRIVATE_QWEN_GATEWAY_TIMEOUT_MS).toBe(210_000);

    const unavailable = new HttpPrivateQwenGateway(
      vi.fn().mockResolvedValue(new Response("", { status: 503 })),
    );
    await expect(
      unavailable.plan({ messages: [{ role: "user", content: "Count all." }] }),
    ).rejects.toMatchObject({ code: "unavailable", retryable: true });

    const upstreamDeadline = new HttpPrivateQwenGateway(
      vi.fn().mockResolvedValue(new Response("", { status: 504 })),
    );
    await expect(
      upstreamDeadline.plan({
        messages: [{ role: "user", content: "Count all." }],
      }),
    ).rejects.toMatchObject({ code: "timeout", retryable: true });

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
