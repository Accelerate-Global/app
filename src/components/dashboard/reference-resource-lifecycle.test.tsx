// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ReferenceResourceLifecycle } from "./reference-resource-lifecycle";

const activeVersion = {
  id: "10000000-0000-4000-8000-000000000001",
  resourceKey: "country-territory-codes" as const,
  versionNumber: 1,
  lifecycleState: "valid" as const,
  schemaVersion: 1,
  contentChecksum: "a".repeat(64),
  sourceRetrievedAt: "2026-07-17T00:00:00.000Z",
  entryCount: 273,
  validationSummary: {},
  diffSummary: {},
  createdByOwnerId: "admin-1",
  createdAt: "2026-07-17T00:00:00.000Z",
  finalizedAt: "2026-07-17T00:00:00.000Z",
  rejectionReason: null,
  isActive: true,
};

describe("ReferenceResourceLifecycle", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("shows active metadata and a validated candidate review", () => {
    render(
      <ReferenceResourceLifecycle
        resourceKey="country-territory-codes"
        activeVersion={activeVersion}
        candidate={{
          unchanged: false,
          version: { ...activeVersion, id: "20000000-0000-4000-8000-000000000002", versionNumber: 2, isActive: false, diffSummary: { changed: 2 } },
        }}
      />,
    );
    expect(screen.getByText("Updated Jul 17, 2026, 12:00 AM UTC")).toBeTruthy();
    expect(screen.queryByText("Active v1")).toBeNull();
    expect(screen.queryByText(/Retrieved/u)).toBeNull();
    expect(screen.getByText("Version 2 is ready for review")).toBeTruthy();
    expect(screen.getByText(/"changed": 2/u)).toBeTruthy();
  });

  it("loads immutable history through the guarded API", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          versions: [activeVersion],
          activationHistory: [],
          impact: {
            resourceKey: "country-territory-codes",
            affectedEngines: [{
              engineKey: "joshua-project",
              displayName: "Joshua Project source forming",
              sourceProfileKeys: ["joshua-project-people-groups"],
              publicationTargetKey: "joshua-project-people-groups",
            }],
            olderBindings: [{
              formingRunId: "run-1",
              sourceProfileKey: "joshua-project-people-groups",
              engineKey: "joshua-project",
              status: "published",
              datasetId: "dataset-1",
              createdAt: "2026-07-16T00:00:00.000Z",
              resourceVersionId: "older-version",
              checksum: "b".repeat(64),
            }],
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    render(
      <ReferenceResourceLifecycle
        resourceKey="country-territory-codes"
        activeVersion={activeVersion}
        candidate={null}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /version history/iu }));
    await waitFor(() => expect(screen.getByText(/Version 1 · Active/u)).toBeTruthy());
    expect(screen.getByText(/Jul 17, 2026, 12:00 AM UTC · valid/u)).toBeTruthy();
    expect(screen.getByText("Pipeline impact")).toBeTruthy();
    expect(screen.getByText("Joshua Project source forming")).toBeTruthy();
    expect(
      screen.getByText(
        "1 existing candidate or publication uses an older version.",
      ),
    ).toBeTruthy();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/reference-resources/country-territory-codes/versions",
    );
  });
});
