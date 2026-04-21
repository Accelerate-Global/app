import { redirect } from "next/navigation";

import { getCurrentIdentity } from "@/lib/auth";
import { getDefaultDataset } from "@/lib/datasets";

export default async function DatasetsIndexPage() {
  const identity = await getCurrentIdentity();

  if (!identity) {
    redirect("/");
  }

  const dataset = await getDefaultDataset({
    includeDisabled: identity.isDatasetAdmin,
  });

  if (!dataset) {
    redirect("/dashboard");
  }

  redirect(`/dashboard/datasets/${dataset.id}?source=default_redirect`);
}
