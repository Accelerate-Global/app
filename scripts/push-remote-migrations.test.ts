import { describe, expect, it } from "vitest";

import { buildRemoteMigrationPushInvocation } from "./push-remote-migrations";

describe("buildRemoteMigrationPushInvocation", () => {
  it("keeps the decoded database password out of process arguments", () => {
    const password = "private value@with spaces";
    const invocation = buildRemoteMigrationPushInvocation(
      `postgresql://postgres:${encodeURIComponent(password)}@db.example.test/postgres`,
      { NODE_ENV: "test", SAFE_PARENT_VALUE: "present" },
    );

    expect(invocation.command).toBe("supabase");
    expect(invocation.args).toEqual(["db", "push", "--include-all"]);
    expect(invocation.args.join(" ")).not.toContain(password);
    expect(invocation.args.join(" ")).not.toContain(encodeURIComponent(password));
    expect(invocation.options.env).toMatchObject({
      NODE_ENV: "test",
      SAFE_PARENT_VALUE: "present",
      SUPABASE_DB_PASSWORD: password,
    });
  });

  it("fails before invoking Supabase when the URL has no password", () => {
    expect(() =>
      buildRemoteMigrationPushInvocation(
        "postgresql://postgres@db.example.test/postgres",
      ),
    ).toThrow("DATABASE_URL must include the remote database password.");
  });
});
