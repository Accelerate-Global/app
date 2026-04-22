import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WORKFLOW_DIR = fileURLToPath(
  new URL("../.github/workflows", import.meta.url),
);
const SHARED_BOOTSTRAP_ACTION = "./.github/actions/setup-pnpm-node";

export function findWorkflowBootstrapIssues(workflows) {
  return workflows.flatMap(({ name, content }) => {
    const issues = [];
    const usesSharedBootstrap = content.includes(`uses: ${SHARED_BOOTSTRAP_ACTION}`);
    const usesDirectPnpmSetup = /uses:\s*pnpm\/action-setup@/m.test(content);
    const usesDirectSetupNode = /uses:\s*actions\/setup-node@/m.test(content);
    const runsPnpmCommands = /\bpnpm\s+(install|run|exec|audit)\b/m.test(content);
    const requiresBootstrap =
      usesSharedBootstrap ||
      usesDirectPnpmSetup ||
      usesDirectSetupNode ||
      runsPnpmCommands;

    if (!requiresBootstrap) {
      return issues;
    }

    if (!usesSharedBootstrap) {
      issues.push(
        `${name}: runs pnpm commands but does not use ${SHARED_BOOTSTRAP_ACTION}.`,
      );
    }

    if (usesDirectPnpmSetup) {
      issues.push(
        `${name}: must not call pnpm/action-setup directly; use ${SHARED_BOOTSTRAP_ACTION} instead.`,
      );
    }

    if (usesDirectSetupNode) {
      issues.push(
        `${name}: must not call actions/setup-node directly; use ${SHARED_BOOTSTRAP_ACTION} instead.`,
      );
    }

    return issues;
  });
}

export async function loadWorkflowFiles(workflowDir = WORKFLOW_DIR) {
  const entries = await readdir(workflowDir, { withFileTypes: true });
  const workflowFiles = entries
    .filter((entry) => entry.isFile() && /\.(ya?ml)$/u.test(entry.name))
    .map((entry) => entry.name)
    .sort();

  return Promise.all(
    workflowFiles.map(async (name) => ({
      name,
      content: await readFile(path.join(workflowDir, name), "utf8"),
    })),
  );
}

async function main() {
  const workflows = await loadWorkflowFiles();
  const issues = findWorkflowBootstrapIssues(workflows);

  if (issues.length > 0) {
    console.error("Workflow bootstrap policy violations:");
    for (const issue of issues) {
      console.error(`- ${issue}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log("Workflow bootstrap policy OK.");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
