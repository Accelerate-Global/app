import { readFile } from "node:fs/promises";

import {
  UI_SMOKE_BOOTSTRAP_FILE,
  type UiSmokeBootstrap,
} from "./smoke-data";

let cachedBootstrap: UiSmokeBootstrap | null = null;

export async function readUiSmokeBootstrap() {
  if (cachedBootstrap) {
    return cachedBootstrap;
  }

  const content = await readFile(UI_SMOKE_BOOTSTRAP_FILE, "utf8");
  cachedBootstrap = JSON.parse(content) as UiSmokeBootstrap;
  return cachedBootstrap;
}

export function resolveUiSmokeTemplate(
  value: string,
  bootstrap: UiSmokeBootstrap,
) {
  return value.replaceAll(/\{\{([^}]+)\}\}/g, (_, alias: string) => {
    const trimmedAlias = alias.trim() as keyof UiSmokeBootstrap["aliases"];
    const resolvedValue = bootstrap.aliases[trimmedAlias];

    if (!resolvedValue) {
      throw new Error(`Unknown UI smoke alias: ${trimmedAlias}`);
    }

    return resolvedValue;
  });
}
