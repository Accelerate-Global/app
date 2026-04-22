import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildProfileEnvironment,
  parseProfileDatasetDetailArgs,
  summarizeSortTrace,
} from "./profile-dataset-detail";

describe("parseProfileDatasetDetailArgs", () => {
  it("uses defaults when optional flags are omitted", () => {
    const parsed = parseProfileDatasetDetailArgs([]);

    expect(parsed.baseUrl).toBe("http://127.0.0.1:3100");
    expect(parsed.datasetId).toBe("a0f20f00-b902-4485-a796-c1027b7dfc21");
    expect(parsed.headed).toBe(false);
    expect(parsed.keepServer).toBe(false);
    expect(parsed.skipBuild).toBe(false);
    expect(parsed.reportSuffix).toBeNull();
  });

  it("accepts explicit CLI overrides", () => {
    const parsed = parseProfileDatasetDetailArgs([
      "--base-url",
      "http://127.0.0.1:4100",
      "--dataset-id",
      "dataset-123",
      "--email",
      "person@example.com",
      "--password",
      "secret",
      "--headed",
      "--keep-server",
      "--skip-build",
      "--report-suffix",
      "prototype",
    ]);

    expect(parsed).toEqual({
      baseUrl: "http://127.0.0.1:4100",
      datasetId: "dataset-123",
      email: "person@example.com",
      password: "secret",
      headed: true,
      keepServer: true,
      skipBuild: true,
      reportSuffix: "prototype",
    });
  });
});

describe("buildProfileEnvironment", () => {
  it("prefers .env.local Supabase values over inherited shell values", () => {
    const environment = buildProfileEnvironment({
      processEnv: {
        NODE_ENV: "test",
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "local-key",
        UI_SMOKE_ENABLED: "1",
      },
      fileEnv: {
        NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "remote-key",
      },
    });

    expect(environment.NEXT_PUBLIC_SUPABASE_URL).toBe("https://project.supabase.co");
    expect(environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).toBe("remote-key");
    expect(environment.UI_SMOKE_ENABLED).toBeUndefined();
  });

  it("fills NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY from NEXT_PUBLIC_SUPABASE_ANON_KEY", () => {
    const environment = buildProfileEnvironment({
      processEnv: {
        NODE_ENV: "test",
      },
      fileEnv: {
        NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
      },
    });

    expect(environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).toBe("anon-key");
  });
});

describe("summarizeSortTrace", () => {
  it("sorts columns by comparator duration and rounds timings for reports", () => {
    expect(
      summarizeSortTrace({
        columns: {
          country: {
            modeDetectionCount: 1,
            modeDetectionDurationMs: 1.23456,
            detectedTextCount: 0,
            detectedAlphanumericCount: 1,
            compareCount: 10,
            compareDurationMs: 12.34567,
            textCompareCount: 0,
            textCompareDurationMs: 0,
            alphanumericCompareCount: 10,
            alphanumericCompareDurationMs: 12.34567,
            keyBuildCount: 5,
            keyBuildDurationMs: 2.34567,
            tokenBuildCount: 5,
            tokenBuildDurationMs: 3.45678,
          },
          name: {
            modeDetectionCount: 1,
            modeDetectionDurationMs: 0.55555,
            detectedTextCount: 1,
            detectedAlphanumericCount: 0,
            compareCount: 10,
            compareDurationMs: 4.44444,
            textCompareCount: 10,
            textCompareDurationMs: 4.44444,
            alphanumericCompareCount: 0,
            alphanumericCompareDurationMs: 0,
            keyBuildCount: 5,
            keyBuildDurationMs: 1.11111,
            tokenBuildCount: 0,
            tokenBuildDurationMs: 0,
          },
        },
      }),
    ).toEqual([
      {
        columnId: "country",
        modeDetectionCount: 1,
        modeDetectionDurationMs: 1.235,
        detectedTextCount: 0,
        detectedAlphanumericCount: 1,
        compareCount: 10,
        compareDurationMs: 12.346,
        textCompareCount: 0,
        textCompareDurationMs: 0,
        alphanumericCompareCount: 10,
        alphanumericCompareDurationMs: 12.346,
        keyBuildCount: 5,
        keyBuildDurationMs: 2.346,
        tokenBuildCount: 5,
        tokenBuildDurationMs: 3.457,
      },
      {
        columnId: "name",
        modeDetectionCount: 1,
        modeDetectionDurationMs: 0.556,
        detectedTextCount: 1,
        detectedAlphanumericCount: 0,
        compareCount: 10,
        compareDurationMs: 4.444,
        textCompareCount: 10,
        textCompareDurationMs: 4.444,
        alphanumericCompareCount: 0,
        alphanumericCompareDurationMs: 0,
        keyBuildCount: 5,
        keyBuildDurationMs: 1.111,
        tokenBuildCount: 0,
        tokenBuildDurationMs: 0,
      },
    ]);
  });
});

describe("profileWarmRegionToggle", () => {
  it("warms the canonical Asia, South region toggle", async () => {
    const scriptPath = path.join(
      process.cwd(),
      "scripts/profile-dataset-detail.ts",
    );

    const script = await readFile(scriptPath, "utf8");

    expect(script).toContain('name: "Toggle Asia, South"');
    expect(script).not.toContain('name: "Toggle South Asia"');
  });
});
