import { describe, expect, it } from "vitest";

import {
  getSupabaseMigrationDrift,
  parseDeploymentMarkup,
  parseSupabaseMigrationList,
} from "@/lib/release-process";

describe("release-process", () => {
  it("parses the pretty Supabase migration table format", () => {
    const rows = parseSupabaseMigrationList(`
       Local          | Remote         | Time (UTC)
      ----------------|----------------|---------------------
       20260413203519 | 20260413203519 | 2026-04-13 20:35:19
       20260415155111 |                | 2026-04-15 15:51:11
                      | 20260416010101 | 2026-04-16 01:01:01
    `);

    expect(rows).toEqual([
      {
        localVersion: "20260413203519",
        remoteVersion: "20260413203519",
      },
      {
        localVersion: "20260415155111",
        remoteVersion: null,
      },
      {
        localVersion: null,
        remoteVersion: "20260416010101",
      },
    ]);
  });

  it("surfaces local-only and remote-only migration drift", () => {
    const drift = getSupabaseMigrationDrift([
      {
        localVersion: "20260413203519",
        remoteVersion: "20260413203519",
      },
      {
        localVersion: "20260415155111",
        remoteVersion: null,
      },
      {
        localVersion: null,
        remoteVersion: "20260416010101",
      },
    ]);

    expect(drift).toEqual({
      localOnly: ["20260415155111"],
      remoteOnly: ["20260416010101"],
      hasDrift: true,
    });
  });

  it("extracts the Vercel deployment id and title from rendered markup", () => {
    expect(
      parseDeploymentMarkup(
        '<html data-dpl-id="dpl_123"><head><title>Accelerate Global</title></head></html>',
      ),
    ).toEqual({
      deploymentId: "dpl_123",
      title: "Accelerate Global",
    });
  });
});
