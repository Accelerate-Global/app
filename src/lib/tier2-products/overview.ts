import { getPipelineProductSystemState } from "@/lib/pipeline-products";
import { listPipelineScheduleStates } from "@/lib/pipeline-operations/repository";

import {
  listTier2ContractResources,
  listTier2GoogleSheetConnections,
  listTier2PartnerProfiles,
  listTier2StableTargets,
} from "./admin";
import {
  listEligibleTier2Publications,
  listTier2ProductRuns,
} from "./operations";
import { listTier2PartnerFormingRuns } from "./partner-lifecycle";

export async function getTier2AdminOverview() {
  const [
    profiles,
    resources,
    formingRuns,
    runs,
    targets,
    eligiblePublications,
    connections,
    system,
    scheduleStates,
  ] = await Promise.all([
    listTier2PartnerProfiles(),
    listTier2ContractResources(),
    listTier2PartnerFormingRuns(),
    listTier2ProductRuns(),
    listTier2StableTargets(),
    listEligibleTier2Publications(),
    listTier2GoogleSheetConnections(),
    getPipelineProductSystemState(),
    listPipelineScheduleStates(),
  ]);
  return {
    profiles,
    resources,
    formingRuns,
    runs,
    targets,
    eligiblePublications,
    connections,
    system,
    tier2Schedules: scheduleStates.filter(
      (schedule) => schedule.definitionKey === "tier2-partner",
    ),
  };
}

export type Tier2AdminOverview = Awaited<ReturnType<typeof getTier2AdminOverview>>;
