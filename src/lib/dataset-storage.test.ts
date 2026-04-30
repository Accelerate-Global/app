import { afterEach, describe, expect, it } from "vitest";

import {
  API_CONNECTION_RUN_ARTIFACT_CONTENT_TYPE,
  getApiConnectionRunArtifactReadBuckets,
  getApiConnectionRunArtifactStorageBucket,
} from "@/lib/dataset-storage";

const originalArtifactBucket = process.env.SUPABASE_API_CONNECTION_ARTIFACT_BUCKET;
const originalDatasetBucket = process.env.SUPABASE_STORAGE_BUCKET;

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
});

describe("API connection run artifact storage", () => {
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
