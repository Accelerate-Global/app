import { writeFile } from "node:fs/promises";
import path from "node:path";

import { refreshRopCodeResourceFromHis } from "@/lib/rop-codes";

const outputPath = path.join(process.cwd(), "src/data/rop-codes.generated.json");

async function main() {
  const resource = await refreshRopCodeResourceFromHis();

  await writeFile(outputPath, `${JSON.stringify(resource, null, 2)}\n`, "utf8");

  console.log(
    `Refreshed ${resource.entryCount} ROP code entries from ${resource.featureServerUrl}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
