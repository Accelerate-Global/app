// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { VercelAnalytics } from "@/components/analytics/vercel-analytics";

const { analyticsComponentMock } = vi.hoisted(() => ({
  analyticsComponentMock: vi.fn(
    (props: { beforeSend: (event: { url: string }) => { url: string } }) => {
      void props;
      return null;
    },
  ),
}));

vi.mock("@vercel/analytics/react", () => ({
  Analytics: analyticsComponentMock,
}));

describe("VercelAnalytics", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  it("mounts Vercel Analytics with URL redaction when analytics is active", () => {
    render(<VercelAnalytics />);

    expect(analyticsComponentMock).toHaveBeenCalledTimes(1);

    const props = analyticsComponentMock.mock.calls[0][0];

    expect(
      props.beforeSend({
        url: "https://example.com/dashboard/datasets/8a3bade4-d4ac-43be-8fad-cd20412f2cf9?token=secret#hash",
      }),
    ).toEqual({
      url: "https://example.com/dashboard/datasets/[id]",
    });
  });

  it("does not mount Vercel Analytics when analytics is paused", () => {
    vi.stubEnv("NEXT_PUBLIC_VERCEL_ANALYTICS_PAUSED", "1");

    render(<VercelAnalytics />);

    expect(analyticsComponentMock).not.toHaveBeenCalled();
  });
});
