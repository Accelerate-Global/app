import { describe, expect, it } from "vitest";

import { parseAuthorityActivationArgs } from "./activate-ax-identity-authority";

describe("fresh AX identity authority activation CLI", () => {
  it("requires explicit environment and audit evidence for a dry run", () => {
    expect(
      parseAuthorityActivationArgs([
        "--local",
        "--environment",
        "local",
        "--actor-owner-id",
        "operator-1",
        "--actor-email",
        "operator@example.org",
        "--reason",
        "Initialize empty authority",
      ]),
    ).toEqual({
      mode: "local",
      operation: "dry-run",
      environment: "local",
      actorOwnerId: "operator-1",
      actorEmail: "operator@example.org",
      reason: "Initialize empty authority",
    });
  });

  it("requires the state-bound handshake for commit", () => {
    expect(
      parseAuthorityActivationArgs([
        "--remote",
        "--commit",
        "--attempt-id",
        "00000000-0000-4000-8000-000000000001",
        "--token",
        "secret",
        "--state-fingerprint",
        "a".repeat(64),
      ]),
    ).toMatchObject({ mode: "remote", operation: "commit" });
  });

  it.each([
    [[], "exactly one"],
    [["--local", "--remote"], "exactly one"],
    [["--local"], "--environment"],
    [["--local", "--commit"], "--attempt-id"],
  ])("rejects incomplete arguments", (args, message) => {
    expect(() => parseAuthorityActivationArgs(args)).toThrow(message);
  });
});
