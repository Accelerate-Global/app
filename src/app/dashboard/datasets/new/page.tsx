import { redirect } from "next/navigation";

import { DatasetOnboardingClient } from "@/components/dashboard/dataset-onboarding/dataset-onboarding-client";
import type { OnboardingSource } from "@/components/dashboard/dataset-onboarding/dataset-onboarding-reducer";
import { DashboardPageShell } from "@/components/layout/dashboard-page-shell";
import { getCurrentIdentity } from "@/lib/auth";
import { getGoogleSheetsServiceAccountEmail } from "@/lib/google-sheets";
import {
  buildTier2WorkflowOwnerOptions,
} from "@/lib/api-connections/onboarding-workflows";
import {
  getActiveReferenceResource,
} from "@/lib/reference-resources";
import { SOURCE_ALIASES_RESOURCE_KEY } from "@/lib/reference-resources/pipeline-types";

type DatasetOnboardingPageProps = {
  searchParams: Promise<{ source?: string }>;
};

function configuredServiceAccountEmail() {
  try {
    return getGoogleSheetsServiceAccountEmail();
  } catch {
    return null;
  }
}

async function configuredTier2Owners() {
  try {
    const active = await getActiveReferenceResource(SOURCE_ALIASES_RESOURCE_KEY);
    return buildTier2WorkflowOwnerOptions(active.payload.entries);
  } catch {
    return [];
  }
}

export default async function DatasetOnboardingPage({
  searchParams,
}: DatasetOnboardingPageProps) {
  const identity = await getCurrentIdentity();
  if (!identity) redirect("/");
  if (!identity.isDatasetAdmin) redirect("/dashboard");

  const sourceParam = (await searchParams).source;
  const initialSource: OnboardingSource | null =
    sourceParam === "google-sheets" || sourceParam === "csv" ? sourceParam : null;
  const isConnectionFlow = initialSource === "google-sheets";

  return (
    <div
      data-smoke-page="dataset-onboarding"
      data-smoke-page-ready="dataset-onboarding"
    >
      <DashboardPageShell>
        <section className="space-y-2">
          <h1 className="text-4xl font-semibold tracking-[-0.04em] sm:text-[3.1rem]">
            {isConnectionFlow ? "Add connection" : "Add dataset"}
          </h1>
          <p className="max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">
            {isConnectionFlow
              ? "Connect a Google Sheet, review how its datasets will appear, and import them into Accelerate."
              : "Connect a Google Sheet or upload a CSV, review how it will appear, and import it into Accelerate."}
          </p>
        </section>
        <DatasetOnboardingClient
          serviceAccountEmail={configuredServiceAccountEmail()}
          initialSource={initialSource}
          tier2OwnerOptions={await configuredTier2Owners()}
        />
      </DashboardPageShell>
    </div>
  );
}
