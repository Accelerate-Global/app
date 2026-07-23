import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("PipelineProductsClient", () => {
  it("exposes the complete review lifecycle and browser-smoke run detail surface", async () => {
    const source = await readFile("src/components/pipeline-products/pipeline-products-client.tsx", "utf8");
    expect(source).toContain("Finalize a Tier 1 release");
    expect(source).toContain("Build a product candidate");
    expect(source).toContain("Out of date");
    expect(source).toContain('data-smoke-trigger="pipeline-product-run-detail"');
    expect(source).toContain('data-smoke-surface="pipeline-product-run-detail"');
    expect(source).toContain('data-smoke-ready="pipeline-product-run-detail"');
    expect(source).toContain("Publish to stable target");
    expect(source).toContain("expectedCurrentPublicationId");
  });
});
