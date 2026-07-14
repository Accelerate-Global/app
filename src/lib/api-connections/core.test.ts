import { describe, expect, it, vi } from "vitest";

import {
  ApiConnectionError,
  createPinnedApiLookup,
  fetchWithSafeRedirects,
  isBlockedApiIpAddress,
  resolveSafeApiUrl,
} from "@/lib/api-connections/core";

const publicV4 = { address: "93.184.216.34", family: 4 as const };
const publicV6 = {
  address: "2606:2800:220:1:248:1893:25c8:1946",
  family: 6 as const,
};

function createResolver(address: { address: string; family: 4 | 6 } = publicV4) {
  return vi.fn(async (value: string) => ({
    url: new URL(value),
    address,
  }));
}

describe("API URL network safety", () => {
  it.each([
    "0.0.0.0",
    "10.0.0.1",
    "100.64.0.1",
    "127.0.0.1",
    "169.254.169.254",
    "172.16.0.1",
    "192.168.1.1",
    "224.0.0.1",
    "255.255.255.255",
    "::",
    "::1",
    "::ffff:127.0.0.1",
    "fc00::1",
    "fe80::1",
    "ff02::1",
    "not-an-ip",
  ])("blocks non-public address %s", (address) => {
    expect(isBlockedApiIpAddress(address)).toBe(true);
  });

  it.each([publicV4.address, publicV6.address, "8.8.8.8", "2001:4860:4860::8888"])(
    "allows global-unicast address %s",
    (address) => {
      expect(isBlockedApiIpAddress(address)).toBe(false);
    },
  );

  it.each([
    "http://example.com/data",
    "file:///etc/passwd",
    "https://user:secret@example.com/data",
    "not a url",
  ])("rejects unsafe URL syntax %s", async (value) => {
    await expect(resolveSafeApiUrl(value, vi.fn())).rejects.toBeInstanceOf(
      ApiConnectionError,
    );
  });

  it("rejects the entire hostname when any DNS answer is blocked", async () => {
    const resolver = vi.fn(async () => [
      publicV4,
      { address: "127.0.0.1", family: 4 as const },
    ]);

    await expect(
      resolveSafeApiUrl("https://example.com/data", resolver),
    ).rejects.toThrow(/blocked network/);
  });

  it("returns one validated address for connection pinning", async () => {
    const resolver = vi.fn(async () => [publicV6, publicV4]);

    await expect(
      resolveSafeApiUrl("https://example.com/data", resolver),
    ).resolves.toEqual({
      url: new URL("https://example.com/data"),
      address: publicV6,
    });
  });

  it("pins both single-address and all-address socket lookups", async () => {
    const lookup = createPinnedApiLookup(publicV6);

    await expect(
      new Promise((resolve, reject) => {
        lookup("example.com", { all: false }, (error, address, family) => {
          if (error) reject(error);
          else resolve({ address, family });
        });
      }),
    ).resolves.toEqual({ address: publicV6.address, family: 6 });

    await expect(
      new Promise((resolve, reject) => {
        lookup("example.com", { all: true }, (error, addresses) => {
          if (error) reject(error);
          else resolve(addresses);
        });
      }),
    ).resolves.toEqual([publicV6]);
  });

  it("normalizes DNS failures without exposing resolver details", async () => {
    const resolver = vi.fn(async () => {
      throw new Error("internal resolver detail");
    });

    await expect(
      resolveSafeApiUrl("https://example.com/data", resolver),
    ).rejects.toThrow("API connection hostname could not be resolved.");
  });
});

describe("fetchWithSafeRedirects", () => {
  it("passes the validated DNS address to the HTTPS request", async () => {
    const resolve = createResolver(publicV6);
    const request = vi.fn(async () => new Response("ok"));

    await fetchWithSafeRedirects(
      {
        url: "https://example.com/data",
        init: { headers: { authorization: "Bearer secret" } },
      },
      { resolve, request },
    );

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: new URL("https://example.com/data"),
        address: publicV6,
      }),
    );
  });

  it("follows relative same-origin redirects and re-resolves every hop", async () => {
    const resolve = createResolver();
    const request = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, { status: 302, headers: { location: "/next" } }),
      )
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));

    const response = await fetchWithSafeRedirects(
      { url: "https://example.com/start", init: { method: "GET" } },
      { resolve, request },
    );

    expect(await response.text()).toBe("ok");
    expect(resolve).toHaveBeenNthCalledWith(1, "https://example.com/start");
    expect(resolve).toHaveBeenNthCalledWith(2, "https://example.com/next");
  });

  it.each([
    "https://other.example/path",
    "https://example.com:444/path",
    "https://sub.example.com/path",
  ])("rejects cross-origin redirect %s before forwarding credentials", async (location) => {
    const resolve = createResolver();
    const request = vi.fn(async () =>
      new Response(null, { status: 302, headers: { location } }),
    );

    await expect(
      fetchWithSafeRedirects(
        {
          url: "https://example.com/start",
          init: {
            method: "POST",
            headers: { authorization: "Bearer secret" },
            body: "sensitive body",
          },
        },
        { resolve, request },
      ),
    ).rejects.toThrow(/original origin/);

    expect(resolve).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("rejects redirects beyond the configured limit", async () => {
    const resolve = createResolver();
    const request = vi.fn(async ({ url }: { url: URL }) =>
      new Response(null, {
        status: 302,
        headers: { location: `/hop-${Number(url.pathname.split("-")[1] ?? 0) + 1}` },
      }),
    );

    await expect(
      fetchWithSafeRedirects(
        { url: "https://example.com/hop-0", init: {} },
        { resolve, request },
      ),
    ).rejects.toThrow(/too many times/);

    expect(request).toHaveBeenCalledTimes(4);
  });

  it("returns ordinary non-redirect error responses", async () => {
    const response = new Response("upstream failure", { status: 500 });

    await expect(
      fetchWithSafeRedirects(
        { url: "https://example.com/data", init: {} },
        {
          resolve: createResolver(),
          request: vi.fn(async () => response),
        },
      ),
    ).resolves.toBe(response);
  });
});
