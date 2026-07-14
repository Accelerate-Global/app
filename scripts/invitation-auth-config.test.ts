import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const config = readFileSync("supabase/config.toml", "utf8");

describe("invitation-only Supabase Auth config", () => {
  it("disables global self-signup without disabling email sign-in", () => {
    expect(config).toMatch(/\[auth\][\s\S]*?enable_signup\s*=\s*false/u);
    expect(config).toMatch(/\[auth\.email\][\s\S]*?enable_signup\s*=\s*true/u);
  });
});
