export type GitChangedFile = {
  path: string;
  status: string;
  displayPath: string;
};

export function parseGitStatusPorcelain(output: string): GitChangedFile[] {
  const entries: GitChangedFile[] = [];
  const tokens = output.split("\0");

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];

    if (!token) {
      continue;
    }

    const status = token.slice(0, 2);
    const firstPath = token.slice(3);
    const isRenameOrCopy = status.includes("R") || status.includes("C");

    if (isRenameOrCopy) {
      const nextPath = tokens[index + 1];

      if (!nextPath) {
        continue;
      }

      entries.push({
        path: nextPath,
        status: status.trim(),
        displayPath: `${nextPath} (from ${firstPath})`,
      });
      index += 1;
      continue;
    }

    entries.push({
      path: firstPath,
      status: status.trim() || "??",
      displayPath: firstPath,
    });
  }

  return entries;
}
