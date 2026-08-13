import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import * as repository from "./repository";

describe("AX identity repository contract", () => {
  it("exports exact publication and revision lookup adapters for downstream stages", () => {
    expect(repository.getPipelinePublication).toBeTypeOf("function");
    expect(repository.getCurrentIdentityPublication).toBeTypeOf("function");
    expect(repository.listPipelinePublications).toBeTypeOf("function");
    expect(repository.getIdentityRegistryRevision).toBeTypeOf("function");
    expect(repository.listActiveIdentityBindings).toBeTypeOf("function");
    expect(repository.getAxIdentityAuthorityStatus).toBeTypeOf("function");
  });

  it("reads the authority activation timestamp from its immutable creation time", () => {
    const source = readFileSync(new URL("./repository.ts", import.meta.url), "utf8");

    expect(source).toContain("authority.created_at as activated_at");
    expect(source).not.toContain("authority.formatter_checksum, authority.activated_at");
  });
});
