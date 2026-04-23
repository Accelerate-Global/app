export type GitChangedFile = {
  path: string;
  status: string;
  displayPath: string;
};

function buildChangedFileEntry(input: {
  firstPath: string;
  nextPath?: string;
  status: string;
}) {
  const trimmedStatus = input.status.trim() || "??";
  const isRenameOrCopy = trimmedStatus.includes("R") || trimmedStatus.includes("C");

  if (isRenameOrCopy && input.nextPath) {
    return {
      path: input.nextPath,
      status: trimmedStatus,
      displayPath: `${input.nextPath} (from ${input.firstPath})`,
    } satisfies GitChangedFile;
  }

  return {
    path: input.firstPath,
    status: trimmedStatus,
    displayPath: input.firstPath,
  } satisfies GitChangedFile;
}

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

      entries.push(
        buildChangedFileEntry({
          firstPath,
          nextPath,
          status,
        }),
      );
      index += 1;
      continue;
    }

    entries.push(
      buildChangedFileEntry({
        firstPath,
        status,
      }),
    );
  }

  return entries;
}

export function parseGitDiffNameStatus(output: string): GitChangedFile[] {
  const entries: GitChangedFile[] = [];
  const tokens = output.split("\0");

  for (let index = 0; index < tokens.length; index += 2) {
    const status = tokens[index];
    const firstPath = tokens[index + 1];

    if (!status || !firstPath) {
      continue;
    }

    const trimmedStatus = status.trim();
    const isRenameOrCopy = trimmedStatus.includes("R") || trimmedStatus.includes("C");

    if (isRenameOrCopy) {
      const nextPath = tokens[index + 2];

      if (!nextPath) {
        continue;
      }

      entries.push(
        buildChangedFileEntry({
          firstPath,
          nextPath,
          status: trimmedStatus,
        }),
      );
      index += 1;
      continue;
    }

    entries.push(
      buildChangedFileEntry({
        firstPath,
        status: trimmedStatus,
      }),
    );
  }

  return entries;
}
