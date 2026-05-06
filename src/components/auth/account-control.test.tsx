// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AccountControl } from "./account-control";

const pushMock = vi.fn();
const refreshMock = vi.fn();
const fetchMock = vi.fn();
const assignMock = vi.fn();
const localStorageStore = new Map<string, string>();
let setSystemDark: (matches: boolean) => void = () => undefined;
const { pathnameMock, trackAppEventMock } = vi.hoisted(() => ({
  pathnameMock: vi.fn(),
  trackAppEventMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    refresh: refreshMock,
  }),
  usePathname: () => pathnameMock(),
}));

vi.mock("@/lib/analytics-client", () => ({
  trackAppEvent: trackAppEventMock,
}));

function openMenu() {
  const trigger = document.querySelector(
    '[data-smoke-trigger="account-menu"]',
  ) as HTMLElement | null;
  expect(trigger).toBeTruthy();
  fireEvent.click(trigger!);
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

function installLocalStorageMock() {
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: vi.fn((key: string) => localStorageStore.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        localStorageStore.set(key, value);
      }),
      removeItem: vi.fn((key: string) => {
        localStorageStore.delete(key);
      }),
    },
  });
}

function installMatchMediaMock(initialMatches = false) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  let matches = initialMatches;
  const media = "(prefers-color-scheme: dark)";
  const mediaQueryList = {
    media,
    get matches() {
      return matches;
    },
    onchange: null,
    addEventListener: vi.fn(
      (event: string, listener: (event: MediaQueryListEvent) => void) => {
        if (event === "change") {
          listeners.add(listener);
        }
      },
    ),
    removeEventListener: vi.fn(
      (event: string, listener: (event: MediaQueryListEvent) => void) => {
        if (event === "change") {
          listeners.delete(listener);
        }
      },
    ),
    addListener: vi.fn((listener: (event: MediaQueryListEvent) => void) => {
      listeners.add(listener);
    }),
    removeListener: vi.fn((listener: (event: MediaQueryListEvent) => void) => {
      listeners.delete(listener);
    }),
    dispatchEvent: vi.fn(),
  } as unknown as MediaQueryList;

  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn(() => mediaQueryList),
  });

  setSystemDark = (nextMatches: boolean) => {
    matches = nextMatches;
    const event = {
      matches,
      media,
    } as MediaQueryListEvent;

    listeners.forEach((listener) => listener(event));
  };
}

describe("AccountControl", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorageStore.clear();
    installLocalStorageMock();
    installMatchMediaMock(false);
    global.fetch = fetchMock as typeof fetch;
    pathnameMock.mockReturnValue("/dashboard");
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        ...window.location,
        assign: assignMock,
      },
    });
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
          workspaceRole: "admin",
          isDatasetAdmin: true,
          mode: "supabase",
        }}
      />,
    );

    expect(screen.getByRole("button").getAttribute("data-smoke-trigger-ready")).toBe(
      "account-menu",
    );
    expect(screen.getByRole("button").getAttribute("data-smoke-close")).toBe(
      "account-menu",
    );
    const menu = openMenu();

    expect(screen.getAllByText("Blake Lewis").length).toBeGreaterThan(0);
    expect(screen.getByText("admin@example.com")).toBeTruthy();
    expect(getMenuStructure(menu)).toEqual([
      "separator",
      "Profile",
      "Dashboard",
      "Definitions",
      "Resources",
      "separator",
      "Manage Field Sources",
      "Datasets",
      "Analytics",
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
          email: "pro@example.com",
          fullName: null,
          workspaceRole: "pro",
          isDatasetAdmin: false,
          mode: "supabase",
        }}
      />,
    );

    expect(screen.getByRole("button").textContent).toContain("pro");
    expect(screen.getByRole("button").getAttribute("data-smoke-await-ready")).toBe(
      "true",
    );
    const menu = openMenu();
    expect(screen.getByText("pro@example.com")).toBeTruthy();
    expect(screen.queryByText("Manage Field Sources")).toBeNull();
    expect(screen.queryByText("Upload")).toBeNull();
    expect(screen.queryByText("Field Sources")).toBeNull();
    expect(getMenuStructure(menu)).toEqual([
      "separator",
      "Profile",
      "Dashboard",
      "Definitions",
      "Resources",
      "separator",
      "Sign out",
    ]);
  });

  it("signs out through the existing auth route", async () => {
    render(
      <AccountControl
        identity={{
          ownerId: "owner-1",
          email: "pro@example.com",
          fullName: null,
          workspaceRole: "pro",
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
    expect(trackAppEventMock).toHaveBeenCalledWith(
      "sign_out",
      expect.objectContaining({
        route: "dashboard",
        actor_owner_id: "owner-1",
        workspace_role: "pro",
        source_surface: "account_menu",
        success: true,
      }),
    );
    expect(assignMock).toHaveBeenCalledWith("/");
    expect(pushMock).not.toHaveBeenCalled();
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("selects system by default and clears legacy theme storage", () => {
    localStorageStore.set("ag-theme", "dark");

    render(
      <AccountControl
        identity={{
          ownerId: "owner-1",
          email: "pro@example.com",
          fullName: null,
          workspaceRole: "pro",
          isDatasetAdmin: false,
          mode: "supabase",
        }}
      />,
    );

    openMenu();

    expect(localStorageStore.get("ag-theme")).toBeUndefined();
    expect(localStorageStore.get("ag-theme-preference")).toBe("system");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    const appearanceGroup = screen.getByRole("group", { name: "Appearance" });
    const systemOption = screen.getByRole("button", { name: "System" });
    const lightOption = screen.getByRole("button", { name: "Light" });

    expect(appearanceGroup).toBeTruthy();
    expect(appearanceGroup.className).not.toContain("bg-muted");
    expect(systemOption.getAttribute("aria-pressed")).toBe("true");
    expect(lightOption.getAttribute("aria-pressed")).toBe("false");
    expect(systemOption.className).toContain("hover:bg-muted");
    expect(systemOption.className).toContain("data-[state=on]:bg-muted");
    expect(screen.queryByText("System (Light)")).toBeNull();
  });

  it("tracks theme preference changes using the current pathname route", () => {
    pathnameMock.mockReturnValue("/dashboard/profile");

    render(
      <AccountControl
        identity={{
          ownerId: "owner-1",
          email: "pro@example.com",
          fullName: null,
          workspaceRole: "pro",
          isDatasetAdmin: false,
          mode: "supabase",
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button"));
    fireEvent.click(screen.getByRole("button", { name: "Dark" }));

    expect(trackAppEventMock).toHaveBeenCalledWith(
      "theme_toggled",
      expect.objectContaining({
        route: "profile",
        actor_owner_id: "owner-1",
        workspace_role: "pro",
        source_surface: "account_menu",
        success: true,
        from_preference: "system",
        to_preference: "dark",
        from_theme: "light",
        to_theme: "dark",
      }),
    );
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorageStore.get("ag-theme-preference")).toBe("dark");
  });

  it("applies explicit light and dark overrides", () => {
    localStorageStore.set("ag-theme-preference", "light");
    installMatchMediaMock(true);

    render(
      <AccountControl
        identity={{
          ownerId: "owner-1",
          email: "pro@example.com",
          fullName: null,
          workspaceRole: "pro",
          isDatasetAdmin: false,
          mode: "supabase",
        }}
      />,
    );

    openMenu();
    expect(document.documentElement.classList.contains("dark")).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Light" }));

    expect(localStorageStore.get("ag-theme-preference")).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Dark" }));

    expect(localStorageStore.get("ag-theme-preference")).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("returns to system tracking after selecting System", () => {
    localStorageStore.set("ag-theme-preference", "light");
    installMatchMediaMock(true);

    render(
      <AccountControl
        identity={{
          ownerId: "owner-1",
          email: "pro@example.com",
          fullName: null,
          workspaceRole: "pro",
          isDatasetAdmin: false,
          mode: "supabase",
        }}
      />,
    );

    openMenu();
    fireEvent.click(screen.getByRole("button", { name: "System" }));

    expect(localStorageStore.get("ag-theme-preference")).toBe("system");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("tracks operating system changes while the System preference is active", async () => {
    render(
      <AccountControl
        identity={{
          ownerId: "owner-1",
          email: "pro@example.com",
          fullName: null,
          workspaceRole: "pro",
          isDatasetAdmin: false,
          mode: "supabase",
        }}
      />,
    );

    expect(document.documentElement.classList.contains("dark")).toBe(false);

    setSystemDark(true);

    await waitFor(() => {
      expect(document.documentElement.classList.contains("dark")).toBe(true);
      expect(document.documentElement.style.colorScheme).toBe("dark");
    });
  });

  it("marks the account menu trigger as ready after hydration", async () => {
    render(
      <AccountControl
        identity={{
          ownerId: "owner-1",
          email: "pro@example.com",
          fullName: null,
          workspaceRole: "pro",
          isDatasetAdmin: false,
          mode: "supabase",
        }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("button").getAttribute("data-smoke-trigger-ready")).toBe(
        "account-menu",
      );
    });
  });
});
