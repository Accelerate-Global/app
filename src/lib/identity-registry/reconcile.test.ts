import { describe, expect, it } from "vitest";

import { reconcileAxIdentity, validateSupersession } from "./reconcile";

describe("AX identity reconciliation", () => {
  it("reuses stable current bindings idempotently", () => {
    expect(
      reconcileAxIdentity({
        existing: {
          bindingId: "binding-1",
          pgacCode: "10-jp-100001",
          pgicCode: "10-jp-100001-LAO",
          state: "active",
        },
        generatedPgac: "10-jp-100001",
        generatedPgic: "10-jp-100001-LAO",
      }),
    ).toMatchObject({ status: "reused", bindingId: "binding-1" });
  });

  it("reserves newly generated PGAC and PGIC codes", () => {
    expect(
      reconcileAxIdentity({
        existing: null,
        generatedPgac: "10-jp-100001",
        generatedPgic: "10-jp-100001-LAO",
      }),
    ).toMatchObject({
      status: "reserved",
      pgacCode: "10-jp-100001",
      pgicCode: "10-jp-100001-LAO",
      aliases: [],
    });
  });

  it("permits a PGAC-only identity when current geography is unresolved", () => {
    expect(
      reconcileAxIdentity({
        existing: null,
        generatedPgac: "10-jp-100001",
        generatedPgic: null,
      }),
    ).toMatchObject({
      status: "pgac-only",
      pgacCode: "10-jp-100001",
      pgicCode: null,
      aliases: [],
    });
  });

  it("requires a distinct active supersession target", () => {
    expect(() =>
      validateSupersession({
        currentIdentityId: "one",
        replacementIdentityId: "one",
        replacementState: "active",
      }),
    ).toThrow(/itself/u);
    expect(() =>
      validateSupersession({
        currentIdentityId: "one",
        replacementIdentityId: "two",
        replacementState: "reserved",
      }),
    ).toThrow(/active/u);
  });
});
