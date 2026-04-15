// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AccountControl } from "./account-control";

const pushMock = vi.fn();
const refreshMock = vi.fn();
const fetchMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    refresh: refreshMock,
  }),
}));

describe("AccountControl", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    global.fetch = fetchMock as typeof fetch;
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("shows the full name when present and includes dashboard, field definitions, filter settings, and upload links", () => {
    render(
      <AccountControl
        identity={{
          ownerId: "owner-1",
          email: "admin@example.com",
          fullName: "Blake Lewis",
          isDatasetAdmin: true,
          mode: "supabase",
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button"));

    expect(screen.getAllByText("Blake Lewis").length).toBeGreaterThan(0);
    expect(screen.getByText("admin@example.com")).toBeTruthy();
    expect(screen.getByText("Dashboard")).toBeTruthy();
    expect(screen.getByText("Field Definitions")).toBeTruthy();
    expect(screen.getByText("Filter Settings")).toBeTruthy();
    expect(screen.getByText("Upload")).toBeTruthy();
  });

  it("falls back to the email prefix when there is no full name", () => {
    render(
      <AccountControl
        identity={{
          ownerId: "owner-1",
          email: "viewer@example.com",
          fullName: null,
          isDatasetAdmin: false,
          mode: "supabase",
        }}
      />,
    );

    expect(screen.getByRole("button").textContent).toContain("viewer");
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText("viewer@example.com")).toBeTruthy();
    expect(screen.getByText("Field Definitions")).toBeTruthy();
    expect(screen.queryByText("Filter Settings")).toBeNull();
    expect(screen.queryByText("Upload")).toBeNull();
  });

  it("signs out through the existing auth route", async () => {
    render(
      <AccountControl
        identity={{
          ownerId: "owner-1",
          email: "viewer@example.com",
          fullName: null,
          isDatasetAdmin: false,
          mode: "supabase",
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button"));
    fireEvent.click(screen.getByText("Sign out"));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/auth/sign-out", { method: "POST" });
    });
    expect(pushMock).toHaveBeenCalledWith("/");
    expect(refreshMock).toHaveBeenCalled();
  });
});
