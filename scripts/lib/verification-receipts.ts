import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { VerificationCommandId } from "../../config/change-impact";
import { runCommand } from "./command";

const receiptCommandIds = [
  "typecheck",
  "verify:test-delta",
  "verify:app",
  "smoke:check",
  "test:ui:smoke:targeted",
  "test:ui:smoke",
  "db:security",
  "verify:ship:local",
] as const satisfies VerificationCommandId[];

export type ReceiptCommandId = (typeof receiptCommandIds)[number];

type VerificationReceiptRecord = {
  passedAt: string;
};

export type VerificationReceipt = {
  treeSha: string;
  changedFiles: string[];
  commands: Partial<Record<ReceiptCommandId, VerificationReceiptRecord>>;
};

const receiptCommandIdSet = new Set<string>(receiptCommandIds);

function normalizePath(filePath: string) {
  return filePath.split(path.sep).join("/");
}

function normalizeChangedFiles(changedFiles: string[]) {
  return [...new Set(changedFiles.map(normalizePath))].sort();
}

function getReceiptPath(rootDir: string, treeSha: string) {
  return path.join(rootDir, ".tmp", "verify-cache", `${treeSha}.json`);
}

async function readReceiptFile(rootDir: string, treeSha: string) {
  try {
    const content = await readFile(getReceiptPath(rootDir, treeSha), "utf8");
    return JSON.parse(content) as VerificationReceipt;
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return null;
    }

    throw error;
  }
}

export function isReceiptCommandId(commandId: string): commandId is ReceiptCommandId {
  return receiptCommandIdSet.has(commandId);
}

export function isVerificationSatisfied(
  receipt: VerificationReceipt | null,
  commandId: ReceiptCommandId,
) {
  if (!receipt) {
    return false;
  }

  if (receipt.commands[commandId]) {
    return true;
  }

  if (
    commandId === "smoke:check" &&
    (
      receipt.commands["test:ui:smoke:targeted"] ||
      receipt.commands["test:ui:smoke"]
    )
  ) {
    return true;
  }

  if (
    commandId === "test:ui:smoke:targeted" &&
    receipt.commands["test:ui:smoke"]
  ) {
    return true;
  }

  return false;
}

export async function getTrackedFileTreeSha(rootDir: string) {
  const { stdout } = await runCommand(
    "git",
    ["ls-files", "-z"],
    {
      cwd: rootDir,
      quiet: true,
    },
  );
  const trackedFiles = stdout.split("\0").filter(Boolean);
  const hash = createHash("sha256");

  for (const relativePath of trackedFiles) {
    const absolutePath = path.join(rootDir, relativePath);
    hash.update(relativePath);
    hash.update("\0");

    try {
      hash.update(await readFile(absolutePath));
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        hash.update("deleted");
      } else {
        throw error;
      }
    }

    hash.update("\0");
  }

  return hash.digest("hex");
}

export async function loadVerificationReceipt(input: {
  rootDir: string;
  treeSha: string;
  changedFiles: string[];
}) {
  const receipt = await readReceiptFile(input.rootDir, input.treeSha);

  if (!receipt) {
    return null;
  }

  if (receipt.treeSha !== input.treeSha) {
    return null;
  }

  const currentChangedFiles = normalizeChangedFiles(input.changedFiles);

  if (
    receipt.changedFiles.length !== currentChangedFiles.length ||
    receipt.changedFiles.some((filePath, index) => filePath !== currentChangedFiles[index])
  ) {
    return null;
  }

  return receipt;
}

export async function recordVerificationSuccess(input: {
  rootDir: string;
  treeSha: string;
  changedFiles: string[];
  commandIds: ReceiptCommandId[];
}) {
  const existingReceipt =
    (await readReceiptFile(input.rootDir, input.treeSha)) ?? {
      treeSha: input.treeSha,
      changedFiles: normalizeChangedFiles(input.changedFiles),
      commands: {},
    };
  const receipt: VerificationReceipt = {
    treeSha: input.treeSha,
    changedFiles: normalizeChangedFiles(input.changedFiles),
    commands: {
      ...existingReceipt.commands,
    },
  };
  const passedAt = new Date().toISOString();

  for (const commandId of input.commandIds) {
    receipt.commands[commandId] = { passedAt };
  }

  await mkdir(path.dirname(getReceiptPath(input.rootDir, input.treeSha)), {
    recursive: true,
  });
  await writeFile(
    getReceiptPath(input.rootDir, input.treeSha),
    `${JSON.stringify(receipt, null, 2)}\n`,
    "utf8",
  );
}
