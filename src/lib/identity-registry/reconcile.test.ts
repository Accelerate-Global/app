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
        occupiedCodes: new Map(),
      }),
    ).toMatchObject({ status: "reused", bindingId: "binding-1" });
  });

  it("retains a valid collision-free source code and records generated aliases", () => {
    expect(
      reconcileAxIdentity({
        existing: null,
        generatedPgac: "10-jp-100001",
        generatedPgic: "10-jp-100001-LAO",
        sourcePgac: "10-jp-100002",
        sourcePgic: "10-jp-100002-LAO",
        occupiedCodes: new Map(),
      }),
    ).toMatchObject({
      status: "retained",
      pgacCode: "10-jp-100002",
      aliases: ["10-jp-100001", "10-jp-100001-LAO"],
    });
  });

  it("blocks malformed or colliding source codes", () => {
    expect(
      reconcileAxIdentity({
        existing: null,
        generatedPgac: "10-jp-100001",
        generatedPgic: "10-jp-100001-LAO",
        sourcePgac: "bad",
        sourcePgic: "bad-LAO",
        occupiedCodes: new Map(),
      }).status,
    ).toBe("conflict");
    expect(
      reconcileAxIdentity({
        existing: null,
        generatedPgac: "10-jp-100001",
        generatedPgic: "10-jp-100001-LAO",
        sourcePgac: "10-jp-100002",
        sourcePgic: "10-jp-100002-LAO",
        occupiedCodes: new Map([["10-jp-100002", "other:key"]]),
      }).status,
    ).toBe("conflict");
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
