import { describe, expect, it } from "vitest";

import * as repository from "./repository";

describe("AX identity repository contract", () => {
  it("exports exact publication and revision lookup adapters for downstream stages", () => {
    expect(repository.getPipelinePublication).toBeTypeOf("function");
    expect(repository.getCurrentIdentityPublication).toBeTypeOf("function");
    expect(repository.listPipelinePublications).toBeTypeOf("function");
    expect(repository.getIdentityRegistryRevision).toBeTypeOf("function");
    expect(repository.listActiveIdentityBindings).toBeTypeOf("function");
  });
});
