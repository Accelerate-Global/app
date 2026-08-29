// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PrivateDataChatClient } from "@/components/chat/private-data-chat-client";

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
    expect(screen.queryByLabelText("Ask about approved data")).toBeNull();
  });

  it("streams progress and displays a grounded answer with provenance", async () => {
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
    fireEvent.change(screen.getByLabelText("Ask about approved data"), {
      target: {
        value: "How many people groups are in the current primary dataset?",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ask Qwen" }));

    await waitFor(() => {
      expect(screen.getByText("There are 3 people groups.")).toBeTruthy();
    });
    expect(screen.getByText("people_group_count: 3")).toBeTruthy();
    expect(screen.getByText("Data provenance")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/chat",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content:
                "How many people groups are in the current primary dataset?",
            },
          ],
        }),
      }),
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
    fireEvent.change(screen.getByLabelText("Ask about approved data"), {
      target: { value: "Count all." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ask Qwen" }));

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain(
        "Private data chat is unavailable.",
      );
    });
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
    fireEvent.change(screen.getByLabelText("Ask about approved data"), {
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
    fireEvent.change(screen.getByLabelText("Ask about approved data"), {
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
