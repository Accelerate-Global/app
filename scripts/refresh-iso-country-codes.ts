import { writeFile } from "node:fs/promises";
import path from "node:path";

import { refreshIsoCountryCodeResourceFromOfficialSource } from "@/lib/iso-country-codes";

const outputPath = path.join(
  process.cwd(),
  "src/data/iso-country-codes.generated.json",
);

async function main() {
  const resource = await refreshIsoCountryCodeResourceFromOfficialSource();

  await writeFile(outputPath, `${JSON.stringify(resource, null, 2)}\n`, "utf8");

  console.log(
    `Refreshed ${resource.entryCount} country and territory code entries from ${resource.sourceUrl}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
