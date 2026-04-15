import { smokeCheckDeployment, waitForGitHubDeployment } from "./lib/release";

function readFlag(name: string) {
  const index = process.argv.indexOf(name);

  if (index === -1) {
    return null;
  }

  return process.argv[index + 1] ?? null;
}

async function main() {
  const commitSha = readFlag("--sha") ?? process.env.GITHUB_SHA;
  const productionUrl =
    readFlag("--production-url") ?? "https://data.accelerateglobal.org";
  const expectedTitle = readFlag("--expected-title") ?? "Accelerate Global";

  if (!commitSha) {
    throw new Error("A commit SHA is required via --sha or GITHUB_SHA.");
  }

  console.log(`Waiting for the GitHub production deployment for ${commitSha}...`);
  const deployment = await waitForGitHubDeployment({ commitSha });
  console.log(`GitHub deployment is ready at ${deployment.deploymentUrl}.`);

  console.log(`Verifying ${productionUrl} is healthy...`);
  const smokeCheck = await smokeCheckDeployment({
    productionUrl,
    expectedTitle,
  });

  console.log(`Production alias is healthy at ${smokeCheck.productionUrl}.`);
  console.log(`Vercel deployment id: ${smokeCheck.deploymentId}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
