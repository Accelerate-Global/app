import { createHash } from "node:crypto";

import type { CsvColumn } from "@/lib/api-types";

type SourceRow = {
  rowIndex: number;
  data: Record<string, string>;
};

function createSha256() {
  return createHash("sha256");
}

export function fingerprintPartnerExportSchema(columns: CsvColumn[]) {
  return createSha256()
    .update(JSON.stringify(columns.map(({ key, label, sourceIndex }) => ({
      key,
      label,
      sourceIndex,
    }))))
    .digest("hex");
}

export function fingerprintPartnerExportRows(rows: SourceRow[]) {
  const hash = createSha256();

  for (const row of rows) {
    hash.update(String(row.rowIndex));
    hash.update("\u0000");
    hash.update(JSON.stringify(row.data));
    hash.update("\u0001");
  }

  return hash.digest("hex");
}

export function checksumPartnerExportArtifact(content: string) {
  return createSha256().update(content, "utf8").digest("hex");
}
