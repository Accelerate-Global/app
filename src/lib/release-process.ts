export type SupabaseMigrationListRow = {
  localVersion: string | null;
  remoteVersion: string | null;
};

export function parseSupabaseMigrationList(output: string) {
  const rows: SupabaseMigrationListRow[] = [];

  for (const line of output.split("\n")) {
    const match = line.match(/^\s*(\d{14})?\s*\|\s*(\d{14})?\s*\|/);

    if (!match) {
      continue;
    }

    rows.push({
      localVersion: match[1] ?? null,
      remoteVersion: match[2] ?? null,
    });
  }

  return rows;
}

export function getSupabaseMigrationDrift(rows: SupabaseMigrationListRow[]) {
  const localOnly = rows
    .flatMap((row) => (row.localVersion && !row.remoteVersion ? [row.localVersion] : []));
  const remoteOnly = rows
    .flatMap((row) => (row.remoteVersion && !row.localVersion ? [row.remoteVersion] : []));

  return {
    localOnly,
    remoteOnly,
    hasDrift: localOnly.length > 0 || remoteOnly.length > 0,
  };
}

export function parseDeploymentMarkup(html: string) {
  const deploymentIdMatch = html.match(/data-dpl-id="([^"]+)"/);
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);

  return {
    deploymentId: deploymentIdMatch?.[1] ?? null,
    title: titleMatch?.[1]?.trim() ?? null,
  };
}
