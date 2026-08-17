import { describe, expect, it, vi } from "vitest";

import { ApiConnectionError } from "../core";
import { resolveConnectionProvider } from "../provider";
import {
  JOSHUA_PROJECT_PAGE_SIZE,
  fetchJoshuaProjectPeopleGroupPage,
  fetchJoshuaProjectPeopleGroupPages,
} from "./joshua-project";

const baseUrl =
  "https://api.joshuaproject.net/v1/people_groups.json?include_profile_text=Y&include_resources=Y&page=1&limit=100000&api_key=stored-token";

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("fetchJoshuaProjectPeopleGroupPages", () => {
  it("fetches one normalized, bounded page for durable execution", async () => {
    const result = await fetchJoshuaProjectPeopleGroupPage({
      url: baseUrl,
      headers: new Headers(),
      page: 3,
      pageSize: 2,
      fetchSafe: vi.fn(async ({ url }: { url: string }) => {
        expect(new URL(url).searchParams.get("page")).toBe("3");
        return jsonResponse({ data: [{ PeopleID3: 7 }] });
      }),
    });

    expect(result.recordCount).toBe(1);
    expect(result.terminal).toBe(true);
    expect(JSON.parse(result.body)).toEqual([{ PeopleID3: 7 }]);
    expect(result.fingerprint).toMatch(/^[a-f0-9]{64}$/u);
  });

  it("fetches bounded pages in order, preserves the key, and logs progress", async () => {
    const requestedUrls: URL[] = [];
    const log = vi.fn(async () => undefined);
    const fetchSafe = vi.fn(async ({ url }: { url: string }) => {
      const requestedUrl = new URL(url);
      requestedUrls.push(requestedUrl);

      return requestedUrl.searchParams.get("page") === "1"
        ? jsonResponse([{ PeopleID3: 2 }, { PeopleID3: 1 }])
        : jsonResponse([{ PeopleID3: 3 }]);
    });

    const result = await fetchJoshuaProjectPeopleGroupPages({
      url: baseUrl,
      headers: new Headers(),
      pageSize: 2,
      log,
      fetchSafe,
    });

    expect(JSON.parse(result.body)).toEqual([
      { PeopleID3: 2 },
      { PeopleID3: 1 },
      { PeopleID3: 3 },
    ]);
    expect(result.recordCount).toBe(3);
    expect(result.httpStatus).toBe(200);
    expect(requestedUrls.map((url) => url.searchParams.get("page"))).toEqual([
      "1",
      "2",
    ]);
    expect(requestedUrls.every((url) => url.searchParams.get("limit") === "2")).toBe(
      true,
    );
    expect(
      requestedUrls.every(
        (url) => url.searchParams.get("api_key") === "stored-token",
      ),
    ).toBe(true);
    expect(log).toHaveBeenNthCalledWith(
      1,
      "Fetched Joshua Project page 1: 2 records (2 total).",
    );
    expect(log).toHaveBeenNthCalledWith(
      2,
      "Fetched Joshua Project page 2: 1 record (3 total).",
    );
    expect(log.mock.calls.flat().join(" ")).not.toContain("stored-token");
  });

  it("accepts the legacy data wrapper and an empty terminal page", async () => {
    const fetchSafe = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ data: [{ PeopleID3: 1 }] }))
      .mockResolvedValueOnce(jsonResponse({ data: [] }));

    const result = await fetchJoshuaProjectPeopleGroupPages({
      url: baseUrl,
      headers: new Headers(),
      pageSize: 1,
      fetchSafe,
    });

    expect(JSON.parse(result.body)).toEqual([{ PeopleID3: 1 }]);
    expect(fetchSafe).toHaveBeenCalledTimes(2);
  });

  it("rejects invalid page shapes and non-object records", async () => {
    await expect(
      fetchJoshuaProjectPeopleGroupPages({
        url: baseUrl,
        headers: new Headers(),
        fetchSafe: vi.fn(async () => jsonResponse({ unexpected: [] })),
      }),
    ).rejects.toThrow("did not include a record array");

    await expect(
      fetchJoshuaProjectPeopleGroupPages({
        url: baseUrl,
        headers: new Headers(),
        fetchSafe: vi.fn(async () => jsonResponse(["invalid"])),
      }),
    ).rejects.toThrow("included an invalid record");
  });

  it("rejects a repeated non-empty page", async () => {
    const repeatedPage = Array.from({ length: 2 }, (_, index) => ({ index }));

    await expect(
      fetchJoshuaProjectPeopleGroupPages({
        url: baseUrl,
        headers: new Headers(),
        pageSize: 2,
        fetchSafe: vi.fn(async () => jsonResponse(repeatedPage)),
      }),
    ).rejects.toThrow("repeated page 2");
  });

  it("normalizes an upstream failure and reports its status", async () => {
    const onHttpStatus = vi.fn();

    await expect(
      fetchJoshuaProjectPeopleGroupPages({
        url: baseUrl,
        headers: new Headers(),
        onHttpStatus,
        fetchSafe: vi.fn(async () => jsonResponse({ error: "busy" }, 503)),
      }),
    ).rejects.toEqual(
      expect.objectContaining<ApiConnectionError>({
        name: "ApiConnectionError",
        message: "Joshua Project API request failed with HTTP 503 on page 1.",
        status: 502,
      }),
    );
    expect(onHttpStatus).toHaveBeenCalledWith(503);
  });

  it("enforces page, aggregate byte, and page-count bounds", async () => {
    await expect(
      fetchJoshuaProjectPeopleGroupPages({
        url: baseUrl,
        headers: new Headers(),
        maxPageBytes: 2,
        fetchSafe: vi.fn(async () => jsonResponse([{ id: 1 }])),
      }),
    ).rejects.toThrow("API response is too large");

    await expect(
      fetchJoshuaProjectPeopleGroupPages({
        url: baseUrl,
        headers: new Headers(),
        maxTotalBytes: 2,
        fetchSafe: vi.fn(async () => jsonResponse([{ id: 1 }])),
      }),
    ).rejects.toThrow("aggregate response is too large");

    await expect(
      fetchJoshuaProjectPeopleGroupPages({
        url: baseUrl,
        headers: new Headers(),
        pageSize: 1,
        maxPages: 1,
        fetchSafe: vi.fn(async () => jsonResponse([{ id: 1 }])),
      }),
    ).rejects.toThrow("exceeded 1 pages");
  });

  it("rejects invalid pagination options", async () => {
    await expect(
      fetchJoshuaProjectPeopleGroupPages({
        url: baseUrl,
        headers: new Headers(),
        pageSize: 0,
      }),
    ).rejects.toThrow("page size must be greater than zero");
  });
});

describe("Joshua Project provider registration", () => {
  it("takes precedence over the generic HTTP fallback", () => {
    const provider = resolveConnectionProvider({
      connection: {
        method: "GET",
        responseFormat: "json",
        responseDataPath: "",
        url: baseUrl,
      } as never,
      requestUrl: baseUrl,
    });

    expect(provider.name).toBe("joshua_project");
    expect(JOSHUA_PROJECT_PAGE_SIZE).toBeLessThan(100000);
  });
});
