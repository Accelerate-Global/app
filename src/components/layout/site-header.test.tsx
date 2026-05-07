// @vitest-environment jsdom
/* eslint-disable @next/next/no-img-element */

import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DASHBOARD_CONTENT_WIDTH_CLASS } from "@/components/layout/dashboard-page-shell";
import { SiteHeader } from "@/components/layout/site-header";

vi.mock("next/image", () => ({
  default: ({
    alt,
    ...props
  }: {
    alt: string;
    src: string;
    width: number;
    height: number;
    className?: string;
    priority?: boolean;
  }) => <img alt={alt} {...props} />,
}));

vi.mock("@/components/auth/account-control", () => ({
  AccountControl: () => <div data-testid="account-control" />,
}));

describe("SiteHeader", () => {
  it("uses the shared dashboard desktop width", () => {
    const { container } = render(<SiteHeader showNav={false} />);

    const inner = container.querySelector("header > div");

    expect(inner?.className).toContain(DASHBOARD_CONTENT_WIDTH_CLASS);
    expect(inner?.className).not.toContain("max-w-[1500px]");
  });
});
