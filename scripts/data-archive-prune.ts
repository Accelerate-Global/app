import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { writeCanonicalFile } from "@/lib/data-archive/backup-engine";
import {
  applyApiArtifactPrunePlan,
  generateApiArtifactPrunePlan,
} from "@/lib/data-archive/prune";

function flag(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

async function dryRun() {
  const output = flag("--output");
  if (!output) throw new Error("--output is required for the protected plan file.");
  const now = new Date();
  const planKey = `api-artifacts:${now.toISOString().slice(0, 10).replaceAll("-", "")}`;
  const result = await generateApiArtifactPrunePlan({ now, planKey });
  await writeCanonicalFile(resolve(output), result.plan);
  const reasonCounts = new Map<string, number>();
  for (const decision of result.decisions) {
    for (const reason of decision.reasons) {
      reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
    }
  }
  process.stdout.write(`${JSON.stringify({
    ok: true,
    planKey,
    planChecksum: result.planSha256,
    candidateCount: result.decisions.length,
    eligiblePackageCount: result.decisions.filter((decision) => decision.eligible).length,
    itemCount: result.plan.itemCount,
    totalBytes: result.plan.totalBytes,
    ineligibleReasonCounts: Object.fromEntries([...reasonCounts].sort()),
    productionDeletionEnabled: false,
  })}\n`);
}

async function applyPlan() {
  const planPath = flag("--plan");
  const checksum = flag("--checksum");
  const owner = flag("--owner");
  if (!planPath || !checksum || !owner || !hasFlag("--approve")) {
    throw new Error(
      "Apply requires --plan, --checksum, --owner, and the explicit --approve flag.",
    );
  }
  const result = await applyApiArtifactPrunePlan({
    value: JSON.parse(await readFile(resolve(planPath), "utf8")),
    confirmedChecksum: checksum,
    approvedByOwnerId: owner,
    productionDeletionEnabled:
      process.env.DATA_ARCHIVE_PRODUCTION_PRUNE_ENABLED === "true",
  });
  process.stdout.write(`${JSON.stringify({ ok: true, ...result })}\n`);
}

async function main() {
  const command = process.argv[2];
  if (command === "dry-run") return dryRun();
  if (command === "apply") return applyPlan();
  throw new Error("Usage: data-archive-prune.ts [dry-run|apply]");
}

main().catch((error) => {
  const code = error instanceof Error
    ? error.message.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").slice(0, 128)
    : "archive-prune-failed";
  process.stderr.write(`Data archive prune command failed (${code}).\n`);
  process.exitCode = 1;
});
