import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const testsDir = fileURLToPath(
  new URL("../supabase/tests/database", import.meta.url),
);

async function listSqlFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listSqlFiles(fullPath)));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".sql")) {
      files.push(fullPath);
    }
  }

  return files.sort();
}

function runPsql(file) {
  return new Promise((resolve) => {
    const child = spawn(
      "psql",
      ["-X", "-v", "ON_ERROR_STOP=1", databaseUrl, "-f", file],
      {
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

const files = await listSqlFiles(testsDir);

if (files.length === 0) {
  console.error("No database test files found.");
  process.exit(1);
}

let hasFailure = false;

for (const file of files) {
  console.log(`Running ${file}`);
  const { code, stdout, stderr } = await runPsql(file);

  if (stdout.trim()) {
    process.stdout.write(stdout);
    if (!stdout.endsWith("\n")) {
      process.stdout.write("\n");
    }
  }

  if (stderr.trim()) {
    process.stderr.write(stderr);
    if (!stderr.endsWith("\n")) {
      process.stderr.write("\n");
    }
  }

  const tapLines = stdout
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("ok ") || line.startsWith("not ok "));

  if (code !== 0 || tapLines.some((line) => line.startsWith("not ok "))) {
    hasFailure = true;
  }
}

if (hasFailure) {
  process.exit(1);
}

console.log("Remote database tests passed.");
