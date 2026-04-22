import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WORKFLOW_DIR = fileURLToPath(
  new URL("../.github/workflows", import.meta.url),
);
const SHARED_BOOTSTRAP_ACTION_FILE = fileURLToPath(
  new URL("../.github/actions/setup-pnpm-node/action.yml", import.meta.url),
);
const SHARED_BOOTSTRAP_ACTION = "./.github/actions/setup-pnpm-node";
const REQUIRED_WORKFLOWS = [
  "app-quality.yml",
  "database-security.yml",
  "dependency-audit.yml",
  "ui-smoke.yml",
];

function parseUsesReferences(content) {
  return [...content.matchAll(/uses:\s*([^\s#]+)\s*(?:#.*)?$/gm)].map(
    (match) => match[1],
  );
}

function isPinnedRemoteAction(reference) {
  return /^[^/\s]+\/[^@\s]+@[0-9a-f]{40}$/u.test(reference);
}

function isLocalAction(reference) {
  return reference.startsWith("./") || reference.startsWith("../");
}

export function findMissingRequiredWorkflowIssues(workflows) {
  const presentWorkflows = new Set(workflows.map(({ name }) => name));

  return REQUIRED_WORKFLOWS.filter((name) => !presentWorkflows.has(name)).map(
    (name) => `${name}: required workflow file is missing.`,
  );
}

function findPinnedActionIssues(name, content) {
  return parseUsesReferences(content)
    .filter((reference) => !isLocalAction(reference))
    .filter((reference) => !isPinnedRemoteAction(reference))
    .map(
      (reference) =>
        `${name}: action ref ${reference} must be pinned to a full commit SHA.`,
    );
}

export function findWorkflowBootstrapIssues(workflows) {
  return workflows.flatMap(({ name, content }) => {
    if (!REQUIRED_WORKFLOWS.includes(name)) {
      return [];
    }

    const issues = [];
    const usesSharedBootstrap = content.includes(`uses: ${SHARED_BOOTSTRAP_ACTION}`);
    const usesDirectPnpmSetup = /uses:\s*pnpm\/action-setup@/m.test(content);
    const usesDirectSetupNode = /uses:\s*actions\/setup-node@/m.test(content);

    if (!usesSharedBootstrap) {
      issues.push(
        `${name}: must use ${SHARED_BOOTSTRAP_ACTION}.`,
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

    return [
      ...issues,
      ...findPinnedActionIssues(name, content),
    ];
  });
}

export function findSharedBootstrapActionIssues(content) {
  const issues = [
    ...findPinnedActionIssues(".github/actions/setup-pnpm-node/action.yml", content),
  ];
  const pnpmIndex = content.indexOf("uses: pnpm/action-setup@");
  const nodeIndex = content.indexOf("uses: actions/setup-node@");

  if (pnpmIndex === -1) {
    issues.push(
      ".github/actions/setup-pnpm-node/action.yml: must configure pnpm/action-setup.",
    );
  }

  if (nodeIndex === -1) {
    issues.push(
      ".github/actions/setup-pnpm-node/action.yml: must configure actions/setup-node.",
    );
  }

  if (pnpmIndex !== -1 && nodeIndex !== -1 && pnpmIndex > nodeIndex) {
    issues.push(
      ".github/actions/setup-pnpm-node/action.yml: must configure pnpm/action-setup before actions/setup-node.",
    );
  }

  return issues;
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
  const sharedBootstrapAction = await readFile(
    SHARED_BOOTSTRAP_ACTION_FILE,
    "utf8",
  );
  const issues = [
    ...findMissingRequiredWorkflowIssues(workflows),
    ...findWorkflowBootstrapIssues(workflows),
    ...findSharedBootstrapActionIssues(sharedBootstrapAction),
  ];

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
