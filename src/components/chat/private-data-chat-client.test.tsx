// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  PrivateDataChatClient,
  parsePrivateDataChatStoredViewContext,
} from "@/components/chat/private-data-chat-client";

const fetchMock = vi.fn();

function sseResponse(events: unknown[]) {
  const body = events
    .map((event) => {
      const type = (event as { type: string }).type;
      return `event: ${type}\ndata: ${JSON.stringify(event)}\n\n`;
    })
    .join("");

  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

describe("PrivateDataChatClient", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders a stable unavailable state without a prompt form", () => {
    render(<PrivateDataChatClient available={false} />);

    expect(
      screen.getByText("Private data chat is not configured"),
    ).toBeTruthy();
    expect(
      screen.queryByRole("textbox", { name: "Question for Qwen" }),
    ).toBeNull();
  });

  it("streams progress and displays a grounded answer without provenance chrome", async () => {
    fetchMock.mockResolvedValue(
      sseResponse([
        { type: "status", stage: "interpreting" },
        { type: "status", stage: "querying" },
        {
          type: "message",
          message: {
            content: "There are 3 people groups.",
            facts: ["people_group_count: 3"],
            provenance: {
              queryId: "8a000001-1337-403d-8eb5-b7c44a1be131",
              catalogVersion: "primary-people-groups-v1",
              dataset: "primary_people_groups",
              datasetId: "7a000001-1337-403d-8eb5-b7c44a1be131",
              datasetVersionCreatedAt: "2026-08-26T00:00:00.000Z",
              rowCount: 1,
              filters: [],
            },
          },
        },
        { type: "done" },
      ]),
    );
    render(<PrivateDataChatClient available />);
    expect(screen.queryByText("Ask about approved data")).toBeNull();
    fireEvent.change(screen.getByRole("textbox", { name: "Question for Qwen" }), {
      target: {
        value: "How many people groups are in the current primary dataset?",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ask Qwen" }));

    await waitFor(() => {
      expect(screen.getByText("There are 3 people groups.")).toBeTruthy();
    });
    expect(screen.getByText("people_group_count: 3")).toBeTruthy();
    expect(screen.queryByText("Data provenance")).toBeNull();
    expect(screen.queryByText("primary-people-groups-v1")).toBeNull();
    expect(
      screen.queryByText("8a000001-1337-403d-8eb5-b7c44a1be131"),
    ).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/chat",
      expect.objectContaining({ method: "POST" }),
    );
    const request = JSON.parse(
      String(fetchMock.mock.calls[0]?.[1]?.body),
    ) as Record<string, unknown>;
    expect(request).toMatchObject({
      messages: [
        {
          role: "user",
          content:
            "How many people groups are in the current primary dataset?",
        },
      ],
      turnStateTokens: [],
    });
    expect(request.conversationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u,
    );
  });

  it("shows normalized request failures", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: "Private data chat is unavailable." }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }),
    );
    render(<PrivateDataChatClient available />);
    fireEvent.change(screen.getByRole("textbox", { name: "Question for Qwen" }), {
      target: { value: "Count all." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ask Qwen" }));

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain(
        "Private data chat is unavailable.",
      );
    });
  });

  it("loads signed current-view quick references from session storage and clears them locally", async () => {
    sessionStorage.setItem(
      "private-data-chat:view-context:v1",
      JSON.stringify({
        schemaVersion: 1,
        token: "signed-view-token",
        conversationId: "20000000-0000-4000-8000-000000000002",
        expiresAt: Date.now() + 60_000,
        summary: {
          chips: [
            { label: "All People Groups", detail: null },
            { label: "Sudan", detail: "Country filter" },
            { label: "UUPG", detail: "Current interactive filter" },
          ],
          quickQuestions: ["How many people groups match this view?"],
          returnUrl: "/dashboard/datasets/10000000-0000-4000-8000-000000000001",
          uupgRationale:
            "Blank values remain eligible so incomplete source data does not create a false exclusion.",
        },
      }),
    );
    fetchMock.mockResolvedValue(
      sseResponse([
        {
          type: "message",
          message: { content: "104 match.", facts: [], provenance: null },
        },
        { type: "done" },
      ]),
    );
    render(<PrivateDataChatClient available />);
    await screen.findByText("Sudan");
    expect(screen.getByText("UUPG")).toBeTruthy();
    expect(screen.getByText(/false exclusion/iu)).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", {
        name: "How many people groups match this view?",
      }),
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const request = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(request).toMatchObject({
      conversationId: "20000000-0000-4000-8000-000000000002",
      viewContextToken: "signed-view-token",
    });
    fireEvent.click(screen.getByRole("button", { name: "Clear context" }));
    expect(sessionStorage.getItem("private-data-chat:view-context:v1")).toBeNull();
    expect(screen.queryByText("Sudan")).toBeNull();
  });

  it("rejects forged or unsafe browser-stored view summaries", async () => {
    expect(
      parsePrivateDataChatStoredViewContext({
        schemaVersion: 1,
        token: "signed-view-token",
        conversationId: "20000000-0000-4000-8000-000000000002",
        expiresAt: Date.now() + 60_000,
        summary: {
          chips: [{ label: "All People Groups", detail: null }],
          quickQuestions: [],
          returnUrl: "javascript:alert(1)",
          uupgRationale: null,
        },
      }),
    ).toBeNull();

    sessionStorage.setItem(
      "private-data-chat:view-context:v1",
      JSON.stringify({
        schemaVersion: 1,
        token: "signed-view-token",
        conversationId: "20000000-0000-4000-8000-000000000002",
        expiresAt: Date.now() + 60_000,
        summary: {
          chips: [{ label: "Forged", detail: null }],
          quickQuestions: [],
          returnUrl: "https://attacker.invalid/",
          uupgRationale: null,
        },
      }),
    );
    render(<PrivateDataChatClient available />);
    await waitFor(() =>
      expect(sessionStorage.getItem("private-data-chat:view-context:v1")).toBeNull(),
    );
    expect(screen.queryByText("Forged")).toBeNull();
  });

  it("renders a bounded ROP page with version, full export, and opaque continuation", async () => {
    fetchMock
      .mockResolvedValueOnce(
        sseResponse([
          {
            type: "message",
            message: {
              content: "52 ROP entries match; showing 1–2.",
              facts: ["119434 — Tassomi · Active"],
              provenance: null,
              resourceResult: {
                resourceKey: "rop-codes",
                operation: "search",
                normalizedQuery: "sudan",
                requestedLimit: 25,
                pageOffset: 0,
                returnedCount: 2,
                matchingCount: 52,
                hasMore: true,
                resourceVersion: {
                  id: "10000000-0000-4000-8000-000000000001",
                  versionNumber: 7,
                  contentChecksum: "a".repeat(64),
                },
                entries: [],
                ambiguityChoices: [],
                continuationToken: "opaque-signed-continuation",
                exportUrl:
                  "/api/reference-resources/rop-codes/download?search=sudan",
              },
            },
          },
          { type: "done" },
        ]),
      )
      .mockResolvedValueOnce(
        sseResponse([
          {
            type: "message",
            message: {
              content: "Showing the final page.",
              facts: [],
              provenance: null,
            },
          },
          { type: "done" },
        ]),
      );
    render(<PrivateDataChatClient available />);
    fireEvent.change(screen.getByRole("textbox", { name: "Question for Qwen" }), {
      target: { value: "Search ROP for Sudan" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ask Qwen" }));
    await screen.findByText("52 ROP entries match; showing 1–2.");
    expect(screen.getByText("ROP version 7")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Download all matches" }).getAttribute("href"),
    ).toBe("/api/reference-resources/rop-codes/download?search=sudan");
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const request = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
    expect(request.resourceContinuationToken).toBe(
      "opaque-signed-continuation",
    );
  });

  it.each([
    ["busy", "Private Qwen capacity is currently full."],
    ["timeout", "Private Qwen exceeded its response deadline."],
  ])("renders streamed %s failures", async (code, message) => {
    fetchMock.mockResolvedValue(
      sseResponse([
        { type: "error", code, message, retryable: true },
        { type: "done" },
      ]),
    );
    render(<PrivateDataChatClient available />);
    fireEvent.change(screen.getByRole("textbox", { name: "Question for Qwen" }), {
      target: { value: "Count all." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ask Qwen" }));

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain(message);
    });
  });

  it("cancels an in-flight request without losing the user turn", async () => {
    fetchMock.mockImplementation((_: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => reject(new DOMException("Aborted", "AbortError")),
          { once: true },
        );
      }),
    );
    render(<PrivateDataChatClient available />);
    fireEvent.change(screen.getByRole("textbox", { name: "Question for Qwen" }), {
      target: { value: "Count all." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ask Qwen" }));
    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain("cancelled");
    });
    expect(screen.getByText("Count all.")).toBeTruthy();
  });
});
