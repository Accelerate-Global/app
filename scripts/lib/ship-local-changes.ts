import { type GitChangedFile, parseGitDiffNameStatus } from "./git-status";
import { runCommand } from "./command";

export type ShipLocalDiff = {
  baseRef: "origin/main";
  headRef: "HEAD";
  changedFiles: string[];
  changedEntries: GitChangedFile[];
};

const SHIP_LOCAL_BASE_REF = "origin/main";
const SHIP_LOCAL_HEAD_REF = "HEAD";
const GIT_COMMAND_TIMEOUT_MS = 30_000;

async function refreshShipLocalBaseRef() {
  await runCommand(
    "git",
    [
      "fetch",
      "--quiet",
      "--no-tags",
      "origin",
      "refs/heads/main:refs/remotes/origin/main",
    ],
    {
      quiet: true,
      stdinMode: "ignore",
      timeoutMs: GIT_COMMAND_TIMEOUT_MS,
    },
  );
}

export async function getShipLocalDiff(): Promise<ShipLocalDiff> {
  await refreshShipLocalBaseRef();
  const { stdout } = await runCommand(
    "git",
    ["diff", "--name-status", "-z", `${SHIP_LOCAL_BASE_REF}...${SHIP_LOCAL_HEAD_REF}`],
    {
      quiet: true,
      stdinMode: "ignore",
      timeoutMs: GIT_COMMAND_TIMEOUT_MS,
    },
  );

  const changedEntries = parseGitDiffNameStatus(stdout);

  return {
    baseRef: SHIP_LOCAL_BASE_REF,
    headRef: SHIP_LOCAL_HEAD_REF,
    changedFiles: changedEntries.map((entry) => entry.path),
    changedEntries,
  };
}
