import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const retiredEntrypoints = [
  "src/app/dashboard/chat/page.tsx",
  "src/app/api/chat/route.ts",
  "src/app/api/chat/view-context/route.ts",
  "src/app/api/reference-resources/semantic-context-catalog/guiding-document/route.ts",
];

async function exists(relativePath: string) {
  try {
    await access(path.join(root, relativePath));
    return true;
  } catch {
    return false;
  }
}

async function filesUnder(relativePath: string) {
  try {
    return (await readdir(path.join(root, relativePath), {
      recursive: true,
      withFileTypes: true,
    })).filter((entry) => entry.isFile());
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

describe("retired application surfaces", () => {
  it.each(retiredEntrypoints)("keeps %s absent", async (relativePath) => {
    expect(await exists(relativePath)).toBe(false);
  });

  it("does not register retired routes for browser smoke", async () => {
    const registry = await readFile(
      path.join(root, "tests/ui/route-registry.ts"),
      "utf8",
    );
    expect(registry).not.toContain("/dashboard/chat");
    expect(registry).not.toContain("semantic-context-catalog");
  });

  it("does not retain a deployable private-model runtime namespace", async () => {
    const privateRuntime = await filesUnder("src/lib/private-data-chat");
    const edgeRelay = await filesUnder("infra/cloudflare/qwen-edge-gateway");
    expect(privateRuntime).toEqual([]);
    expect(edgeRelay).toEqual([]);
  });
});
