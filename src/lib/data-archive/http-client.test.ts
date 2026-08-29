import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import type { ClientRequest, IncomingMessage } from "node:http";
import type { request as httpsRequest } from "node:https";

import { describe, expect, it, vi } from "vitest";

import { createArchiveFetch } from "./http-client";

describe("Samson archive HTTPS client", () => {
  it("returns bounded JSON responses without the built-in fetch runtime", async () => {
    const response = Readable.from([JSON.stringify({ access_token: "token" })]) as IncomingMessage;
    response.statusCode = 200;
    response.statusMessage = "OK";
    const request = Object.assign(new EventEmitter(), {
      destroy: vi.fn(),
      end: vi.fn(),
    }) as unknown as ClientRequest;
    const requestImpl = vi.fn((_url, _options, callback) => {
      queueMicrotask(() => callback?.(response));
      return request;
    }) as unknown as typeof httpsRequest;
    const fetchImpl = createArchiveFetch(requestImpl);

    const result = await fetchImpl("https://example.supabase.co/auth/v1/token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });

    expect(result.ok).toBe(true);
    await expect(result.json()).resolves.toEqual({ access_token: "token" });
    expect(request.end).toHaveBeenCalledWith("{}");
  });

  it("rejects non-TLS destinations before opening a request", async () => {
    const requestImpl = vi.fn() as unknown as typeof httpsRequest;
    const fetchImpl = createArchiveFetch(requestImpl);
    await expect(fetchImpl("http://example.test/path")).rejects.toThrow(
      "archive_http_requires_https",
    );
    expect(requestImpl).not.toHaveBeenCalled();
  });
});
