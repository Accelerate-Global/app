// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentIdentity } from "@/lib/auth";
import DatasetOnboardingPage from "./page";

const onboardingClientSpy = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: vi.fn((target: string) => {
    throw new Error(`NEXT_REDIRECT:${target}`);
  }),
}));
vi.mock("@/lib/auth", () => ({ getCurrentIdentity: vi.fn() }));
vi.mock("@/lib/google-sheets", () => ({
  getGoogleSheetsServiceAccountEmail: () =>
    "sheets@app-project.iam.gserviceaccount.com",
}));
vi.mock(
  "@/components/dashboard/dataset-onboarding/dataset-onboarding-client",
  () => ({
    DatasetOnboardingClient: (props: { initialSource: string | null }) => {
      onboardingClientSpy(props);
      return <div data-testid="onboarding-client">{props.initialSource ?? "choose"}</div>;
    },
  }),
);

const getCurrentIdentityMock = vi.mocked(getCurrentIdentity);

describe("/dashboard/datasets/new", () => {
  beforeEach(() => vi.resetAllMocks());

  it("redirects anonymous and non-admin users", async () => {
    getCurrentIdentityMock.mockResolvedValueOnce(null);
    await expect(
      DatasetOnboardingPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("NEXT_REDIRECT:/");

    getCurrentIdentityMock.mockResolvedValueOnce({
      ownerId: "basic-1",
      email: "basic@example.com",
      fullName: null,
      workspaceRole: "basic",
      isDatasetAdmin: false,
      mode: "supabase",
    });
    await expect(
      DatasetOnboardingPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("NEXT_REDIRECT:/dashboard");
  });

  it("renders the admin flow with a supported source deep link", async () => {
    getCurrentIdentityMock.mockResolvedValue({
      ownerId: "admin-1",
      email: "admin@example.com",
      fullName: "Admin",
      workspaceRole: "admin",
      isDatasetAdmin: true,
      mode: "supabase",
    });
    render(
      await DatasetOnboardingPage({
        searchParams: Promise.resolve({ source: "csv" }),
      }),
    );
    expect(screen.getByRole("heading", { name: "Add dataset" })).toBeTruthy();
    expect(screen.getByTestId("onboarding-client").textContent).toBe("csv");
    expect(onboardingClientSpy).toHaveBeenCalledWith(
      expect.not.objectContaining({ actorOwnerId: expect.anything() }),
    );
    expect(document.querySelector('[data-smoke-page="dataset-onboarding"]')).toBeTruthy();
  });

  it("labels the Google Sheets deep link as Add connection", async () => {
    getCurrentIdentityMock.mockResolvedValue({
      ownerId: "admin-1",
      email: "admin@example.com",
      fullName: "Admin",
      workspaceRole: "admin",
      isDatasetAdmin: true,
      mode: "supabase",
    });
    render(
      await DatasetOnboardingPage({
        searchParams: Promise.resolve({ source: "google-sheets" }),
      }),
    );
    expect(screen.getByRole("heading", { name: "Add connection" })).toBeTruthy();
    expect(screen.getByText(/Connect a Google Sheet/)).toBeTruthy();
    expect(screen.getByTestId("onboarding-client").textContent).toBe("google-sheets");
  });
});
