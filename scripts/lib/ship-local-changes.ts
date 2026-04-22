import { runCommand } from "./command";

export type ShipLocalDiff = {
  baseRef: "origin/main";
  headRef: "HEAD";
  changedFiles: string[];
};

const SHIP_LOCAL_BASE_REF = "origin/main";
const SHIP_LOCAL_HEAD_REF = "HEAD";
const GIT_COMMAND_TIMEOUT_MS = 30_000;

function parseNullSeparatedPaths(output: string) {
  return output
    .split("\0")
    .map((token) => token.trim())
    .filter(Boolean);
}

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
    ["diff", "--name-only", "-z", `${SHIP_LOCAL_BASE_REF}...${SHIP_LOCAL_HEAD_REF}`],
    {
      quiet: true,
      stdinMode: "ignore",
      timeoutMs: GIT_COMMAND_TIMEOUT_MS,
    },
  );

  return {
    baseRef: SHIP_LOCAL_BASE_REF,
    headRef: SHIP_LOCAL_HEAD_REF,
    changedFiles: parseNullSeparatedPaths(stdout),
  };
}
