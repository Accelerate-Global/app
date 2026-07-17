import { sanitizeFileName } from "@/lib/csv";

import type { PartnerExportArtifactKind } from "./types";

function getSafeStem(value: string, fallback: string) {
  const withoutCsvExtension = value.trim().replace(/\.csv$/iu, "");
  if (!withoutCsvExtension) {
    return fallback;
  }

  return (
    sanitizeFileName(withoutCsvExtension).replace(/\.csv$/iu, "") || fallback
  );
}

function formatDownloadTimestamp(downloadedAt: Date) {
  return downloadedAt
    .toISOString()
    .replace(/\.\d{3}Z$/u, "Z")
    .replaceAll(":", "-");
}

export function getPartnerExportDownloadFileName(input: {
  datasetName: string;
  profileFileNameStem: string;
  kind: PartnerExportArtifactKind;
  downloadedAt: Date;
}) {
  const datasetStem = getSafeStem(input.datasetName, "dataset");
  const profileStem = getSafeStem(
    input.profileFileNameStem,
    "partner-export",
  );
  const baseName = `${datasetStem}-${profileStem}-${formatDownloadTimestamp(input.downloadedAt)}`;

  if (input.kind === "csv") {
    return `${baseName}.csv`;
  }

  return `${baseName}-${input.kind}.json`;
}
