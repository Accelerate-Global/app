import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { headers } from "next/headers";

import RootLayout from "./layout";

vi.mock("next/headers", () => ({
  headers: vi.fn(),
}));

vi.mock("next/font/google", () => ({
  Geist_Mono: () => ({ variable: "font-geist-mono" }),
  Lexend: () => ({ variable: "font-lexend" }),
}));

vi.mock("@/components/ui/tooltip", () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => children,
}));

const headersMock = vi.mocked(headers);

describe("RootLayout CSP nonce", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("applies the proxy nonce to the inline theme script", async () => {
    headersMock.mockResolvedValue(
      new Headers({ "x-nonce": "layoutNonce123" }) as never,
    );

    const markup = renderToStaticMarkup(
      await RootLayout({ children: <main>Workspace</main> }),
    );

    expect(markup).toContain('<script nonce="layoutNonce123">');
    expect(markup).toContain("ag-theme-preference");
  });

  it("does not invent a reusable fallback nonce", async () => {
    headersMock.mockResolvedValue(new Headers() as never);

    const markup = renderToStaticMarkup(
      await RootLayout({ children: <main>Workspace</main> }),
    );

    expect(markup).not.toContain("nonce=");
  });
});
