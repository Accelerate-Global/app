import { afterEach, describe, expect, it } from "vitest";

import {
  API_CONNECTION_RUN_ARTIFACT_CONTENT_TYPE,
  createImbFormingArtifactStoragePath,
  createPartnerExportRunOutputStoragePath,
  createReferenceResourceArtifactStoragePath,
  getApiConnectionRunArtifactReadBuckets,
  getApiConnectionRunArtifactStorageBucket,
  getPartnerExportArtifactStorageBucket,
  getReferenceResourceArtifactStorageBucket,
  isReferenceResourceArtifactStoragePath,
} from "@/lib/dataset-storage";

const originalArtifactBucket = process.env.SUPABASE_API_CONNECTION_ARTIFACT_BUCKET;
const originalDatasetBucket = process.env.SUPABASE_STORAGE_BUCKET;
const originalPartnerExportBucket =
  process.env.SUPABASE_PARTNER_EXPORT_ARTIFACT_BUCKET;
const originalReferenceResourceBucket =
  process.env.SUPABASE_REFERENCE_RESOURCE_ARTIFACT_BUCKET;

afterEach(() => {
  if (originalArtifactBucket === undefined) {
    delete process.env.SUPABASE_API_CONNECTION_ARTIFACT_BUCKET;
  } else {
    process.env.SUPABASE_API_CONNECTION_ARTIFACT_BUCKET = originalArtifactBucket;
  }

  if (originalDatasetBucket === undefined) {
    delete process.env.SUPABASE_STORAGE_BUCKET;
  } else {
    process.env.SUPABASE_STORAGE_BUCKET = originalDatasetBucket;
  }

  if (originalPartnerExportBucket === undefined) {
    delete process.env.SUPABASE_PARTNER_EXPORT_ARTIFACT_BUCKET;
  } else {
    process.env.SUPABASE_PARTNER_EXPORT_ARTIFACT_BUCKET =
      originalPartnerExportBucket;
  }

  if (originalReferenceResourceBucket === undefined) {
    delete process.env.SUPABASE_REFERENCE_RESOURCE_ARTIFACT_BUCKET;
  } else {
    process.env.SUPABASE_REFERENCE_RESOURCE_ARTIFACT_BUCKET =
      originalReferenceResourceBucket;
  }
});

describe("reference resource artifact storage", () => {
  it("uses a dedicated private bucket and deterministic version paths", () => {
    delete process.env.SUPABASE_REFERENCE_RESOURCE_ARTIFACT_BUCKET;

    expect(getReferenceResourceArtifactStorageBucket()).toBe(
      "reference-resource-artifacts",
    );
    const path = createReferenceResourceArtifactStoragePath({
      resourceKey: "country-territory-codes",
      versionId: "version-1",
      kind: "normalized",
    });
    expect(path).toBe(
      "reference-resources/country-territory-codes/version-1/normalized.json",
    );
    expect(isReferenceResourceArtifactStoragePath(path)).toBe(true);
  });

  it("supports a server-side bucket override", () => {
    process.env.SUPABASE_REFERENCE_RESOURCE_ARTIFACT_BUCKET = "custom-reference";
    expect(getReferenceResourceArtifactStorageBucket()).toBe("custom-reference");
  });
});

describe("partner export artifact storage", () => {
  it("uses a dedicated private artifact bucket by default", () => {
    delete process.env.SUPABASE_PARTNER_EXPORT_ARTIFACT_BUCKET;

    expect(getPartnerExportArtifactStorageBucket()).toBe(
      "partner-export-artifacts",
    );
  });

  it("supports an environment override and run-scoped paths", () => {
    process.env.SUPABASE_PARTNER_EXPORT_ARTIFACT_BUCKET = "custom-exports";

    expect(getPartnerExportArtifactStorageBucket()).toBe("custom-exports");
    expect(createPartnerExportRunOutputStoragePath("run-1", "Partner.csv")).toMatch(
      /^partner-export-runs\/run-1\/[0-9a-f-]+-Partner\.csv$/u,
    );
  });
});

describe("API connection run artifact storage", () => {
  it("uses deterministic run-scoped paths for immutable IMB forming artifacts", () => {
    expect(
      createImbFormingArtifactStoragePath({
        sourceRunId: "source-1",
        formingRunId: "forming-1",
        kind: "manifest",
      }),
    ).toBe("imb-forming-runs/source-1/forming-1/manifest.json");
    expect(
      createImbFormingArtifactStoragePath({
        sourceRunId: "source-1",
        formingRunId: "forming-1",
        kind: "csv",
      }),
    ).toBe("imb-forming-runs/source-1/forming-1/csv.csv");
  });

  it("uses a dedicated JSON artifact bucket by default", () => {
    delete process.env.SUPABASE_API_CONNECTION_ARTIFACT_BUCKET;

    expect(getApiConnectionRunArtifactStorageBucket()).toBe(
      "api-connection-artifacts",
    );
    expect(API_CONNECTION_RUN_ARTIFACT_CONTENT_TYPE).toBe("application/json");
  });

  it("allows the artifact bucket to be overridden by environment", () => {
    process.env.SUPABASE_API_CONNECTION_ARTIFACT_BUCKET = "custom-artifacts";

    expect(getApiConnectionRunArtifactStorageBucket()).toBe("custom-artifacts");
  });

  it("reads artifact storage before the legacy dataset bucket", () => {
    process.env.SUPABASE_API_CONNECTION_ARTIFACT_BUCKET = "custom-artifacts";
    process.env.SUPABASE_STORAGE_BUCKET = "datasets";

    expect(getApiConnectionRunArtifactReadBuckets()).toEqual([
      "custom-artifacts",
      "datasets",
    ]);
  });

  it("deduplicates read buckets when artifact storage is explicitly legacy", () => {
    process.env.SUPABASE_API_CONNECTION_ARTIFACT_BUCKET = "datasets";
    process.env.SUPABASE_STORAGE_BUCKET = "datasets";

    expect(getApiConnectionRunArtifactReadBuckets()).toEqual(["datasets"]);
  });
});
