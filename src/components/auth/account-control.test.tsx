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

function openMenu() {
  fireEvent.click(screen.getByRole("button"));
  const menu = document.querySelector('[data-smoke-surface="account-menu"]');
  expect(menu).toBeTruthy();
  return menu as HTMLElement;
}

function getMenuStructure(menu: HTMLElement) {
  return Array.from(
    menu.querySelectorAll('[data-slot="dropdown-menu-item"], [data-slot="dropdown-menu-separator"]'),
  ).map((node) =>
    node.getAttribute("data-slot") === "dropdown-menu-separator"
      ? "separator"
      : node.textContent?.replace(/\s+/g, " ").trim(),
  );
}

describe("AccountControl", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    global.fetch = fetchMock as typeof fetch;
    document.documentElement.classList.remove("dark");
    document.documentElement.style.colorScheme = "";
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders standard and admin rows in separate sections for dataset admins", () => {
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

    const menu = openMenu();

    expect(screen.getAllByText("Blake Lewis").length).toBeGreaterThan(0);
    expect(screen.getByText("admin@example.com")).toBeTruthy();
    expect(getMenuStructure(menu)).toEqual([
      "separator",
      "Profile",
      "Dashboard",
      "Definitions",
      "Dark mode",
      "separator",
      "Field Sources",
      "Filter Settings",
      "User Management",
      "Upload",
      "separator",
      "Sign out",
    ]);
  });

  it("omits the admin section and extra divider for non-admin users", () => {
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
    const menu = openMenu();
    expect(screen.getByText("viewer@example.com")).toBeTruthy();
    expect(screen.queryByText("Field Sources")).toBeNull();
    expect(screen.queryByText("Filter Settings")).toBeNull();
    expect(screen.queryByText("Upload")).toBeNull();
    expect(getMenuStructure(menu)).toEqual([
      "separator",
      "Profile",
      "Dashboard",
      "Definitions",
      "Dark mode",
      "separator",
      "Sign out",
    ]);
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
