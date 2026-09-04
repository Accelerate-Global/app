import { describe, expect, it, vi } from "vitest";

import {
  handlePrivateQwenEdgeRequest,
  type PrivateQwenOrigin,
} from "./index";

function signedRequest(
  path = "/v1/private-data-chat/plan",
  body = '{"question":"hello"}',
) {
  return new Request(`https://edge.example${path}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "CF-Access-Client-Id": "must-not-reach-origin",
      "CF-Access-Client-Secret": "must-not-reach-origin",
      "Content-Length": String(new TextEncoder().encode(body).byteLength),
      "Content-Type": "application/json",
      "X-AG-Nonce": "4bd6354a-b924-4c3e-bebf-5b0c73cc673a",
      "X-AG-Signature": "v1=example",
      "X-AG-Timestamp": "1787871600000",
    },
    body,
  });
}

function fakeOrigin(
  response: Response | (() => Promise<Response>) = Response.json({ ok: true }),
) {
  const calls: Array<{
    resource: string;
    options: Parameters<PrivateQwenOrigin["fetch"]>[1];
  }> = [];
  return {
    calls,
    async fetch(
      resource: string,
      options: Parameters<PrivateQwenOrigin["fetch"]>[1],
    ) {
      calls.push({ resource, options });
      return typeof response === "function" ? response() : response;
    },
  } satisfies PrivateQwenOrigin & { calls: typeof calls };
}

describe("private Qwen edge gateway", () => {
  it.each([
    ["GET", "/v1/private-data-chat/plan", 405],
    ["POST", "/unknown", 404],
    ["POST", "/v1/private-data-chat/plan?debug=1", 404],
  ])("rejects %s %s before the origin", async (method, path, status) => {
    const origin = fakeOrigin();
    const request = new Request(`https://edge.example${path}`, { method });

    const response = await handlePrivateQwenEdgeRequest(request, origin);

    expect(response.status).toBe(status);
    expect(origin.calls).toHaveLength(0);
  });

  it("rejects missing application authentication before the origin", async () => {
    const origin = fakeOrigin();
    const body = "{}";
    const request = new Request(
      "https://edge.example/v1/private-data-chat/answer",
      {
        method: "POST",
        headers: {
          "Content-Length": String(body.length),
          "Content-Type": "application/json",
        },
        body,
      },
    );

    const response = await handlePrivateQwenEdgeRequest(request, origin);

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: { code: "unauthorized" } });
    expect(origin.calls).toHaveLength(0);
  });

  it("rejects unbounded or non-JSON bodies", async () => {
    const origin = fakeOrigin();
    const missingLength = new Request(
      "https://edge.example/v1/private-data-chat/plan",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      },
    );
    missingLength.headers.delete("content-length");
    const wrongType = signedRequest();
    wrongType.headers.set("content-type", "text/plain");

    expect(
      (await handlePrivateQwenEdgeRequest(missingLength, origin)).status,
    ).toBe(413);
    expect(
      (await handlePrivateQwenEdgeRequest(wrongType, origin)).status,
    ).toBe(415);
    expect(origin.calls).toHaveLength(0);
  });

  it("forwards the exact signed request to the private binding and strips Access credentials", async () => {
    const responseBody = '{"decision":"answer"}';
    const originResponse = new Response(responseBody, {
      status: 200,
      headers: {
        "Cache-Control": "private",
        "Content-Length": String(responseBody.length),
        "Content-Type": "application/json",
        Server: "internal-python",
        "Set-Cookie": "private=secret",
      },
    });
    const origin = fakeOrigin(originResponse);
    const request = signedRequest();

    const response = await handlePrivateQwenEdgeRequest(
      request,
      origin,
      () => 1_000,
    );

    expect(origin.calls).toHaveLength(1);
    const [forwarded] = origin.calls;
    expect(forwarded.resource).toBe(
      "https://samson.risencode.org/v1/private-data-chat/plan",
    );
    expect(forwarded.options.headers["x-ag-signature"]).toBe("v1=example");
    expect(forwarded.options.headers["cf-access-client-id"]).toBeUndefined();
    expect(forwarded.options.headers["cf-access-client-secret"]).toBeUndefined();
    expect(forwarded.options.body).not.toBeNull();
    if (forwarded.options.body === null) {
      throw new Error("Expected a forwarded request body");
    }
    expect(new TextDecoder().decode(forwarded.options.body)).toBe(
      '{"question":"hello"}',
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("server")).toBeNull();
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(await response.text()).toBe('{"decision":"answer"}');
  });

  it("permits service-authenticated health checks without an HMAC body", async () => {
    const healthBody = '{"status":"ok"}';
    const origin = fakeOrigin(new Response(healthBody, {
      headers: {
        "Content-Length": String(healthBody.length),
        "Content-Type": "application/json",
      },
    }));

    const response = await handlePrivateQwenEdgeRequest(
      new Request("https://edge.example/health"),
      origin,
    );

    expect(response.status).toBe(200);
    const [forwarded] = origin.calls;
    expect(forwarded.options.method).toBe("GET");
    expect(forwarded.resource).toBe(
      "https://samson.risencode.org/health",
    );
  });

  it.each([
    ["missing length", new Response("{}")],
    [
      "mismatched length",
      new Response("{}", { headers: { "Content-Length": "3" } }),
    ],
    [
      "oversized length",
      new Response("{}", { headers: { "Content-Length": "128001" } }),
    ],
  ])("rejects an origin response with %s", async (_case, originResponse) => {
    const origin = fakeOrigin(originResponse);
    const response = await handlePrivateQwenEdgeRequest(signedRequest(), origin);

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: { code: "invalid_response" },
    });
  });

  it("normalizes private connectivity failures without leaking errors", async () => {
    const origin = fakeOrigin(async () => {
      throw new Error("10.77.0.30 certificate failure");
    });
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await handlePrivateQwenEdgeRequest(
      signedRequest(),
      origin,
      () => 2_000,
    );

    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("5");
    expect(await response.text()).not.toContain("10.77.0.30");
    expect(errorLog).toHaveBeenCalledOnce();
    expect(errorLog.mock.calls[0]?.[0]).not.toContain("certificate failure");
    errorLog.mockRestore();
  });
});
