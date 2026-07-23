import { beforeEach, describe, expect, it, vi } from "vitest";

import { getDb } from "@/db";

import { getPipelineFlowDefinition } from "./registry";
import { snapshotCurrentPipelineInputs } from "./inputs";
import {
  configurePipelineSchedule,
  getDuePipelineSchedules,
} from "./repository";

vi.mock("@/db", () => ({ getDb: vi.fn() }));
vi.mock("./inputs", () => ({ snapshotCurrentPipelineInputs: vi.fn() }));

const execute = vi.fn();
const profileOne = "91000000-0000-4000-8000-000000000001";
const profileTwo = "91000000-0000-4000-8000-000000000002";
const canaryOne = "92000000-0000-4000-8000-000000000001";
const canaryTwo = "92000000-0000-4000-8000-000000000002";
const connectionOne = "93000000-0000-4000-8000-000000000001";
const connectionTwo = "93000000-0000-4000-8000-000000000002";

function tier2ExactInputs(
  profileId: string,
  connectionId: string,
  checksum: string,
  profileContractChecksum = "a".repeat(64),
) {
  return {
    profileId,
    tier2ProfileBindings: {
      [`profile-${profileId}`]: {
        id: profileId,
        connectionId,
        contractChecksum: profileContractChecksum,
      },
    },
    tier2ContractBindings: {
      "jp-peopleid3": {
        resourceKey: "jp-peopleid3",
        versionId: "94000000-0000-4000-8000-000000000001",
        checksum: "b".repeat(64),
        versionNumber: 1,
        schemaVersion: 1,
      },
    },
    sourceExecutionBindings: {
      [`tier2-partner:${profileId}`]: {
        sourceProfileKey: "tier2-partner",
        connectionId,
        checksum,
      },
    },
  };
}

function currentTier2Inputs(
  profiles: ReadonlyArray<{
    profileId: string;
    connectionId: string;
    checksum: string;
    profileContractChecksum?: string;
  }>,
) {
  const first = tier2ExactInputs(
    profiles[0]!.profileId,
    profiles[0]!.connectionId,
    profiles[0]!.checksum,
    profiles[0]!.profileContractChecksum,
  );
  return {
    tier2ProfileBindings: Object.assign(
      {},
      ...profiles.map((profile) =>
        tier2ExactInputs(
          profile.profileId,
          profile.connectionId,
          profile.checksum,
          profile.profileContractChecksum,
        ).tier2ProfileBindings
      ),
    ),
    tier2ContractBindings: first.tier2ContractBindings,
    sourceExecutionBindings: Object.assign(
      {},
      ...profiles.map((profile) =>
        tier2ExactInputs(
          profile.profileId,
          profile.connectionId,
          profile.checksum,
          profile.profileContractChecksum,
        ).sourceExecutionBindings
      ),
    ),
  };
}

describe("profile-aware pipeline schedules", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getDb).mockReturnValue({ execute } as never);
    vi.mocked(snapshotCurrentPipelineInputs).mockResolvedValue(
      tier2ExactInputs(profileOne, connectionOne, "canary-one") as never,
    );
  });

  it("rejects intervals that the daily Vercel cron cannot honor", async () => {
    await expect(configurePipelineSchedule({
      definitionKey: "source-imb-people-groups",
      enabled: true,
      intervalMinutes: 60,
      canaryRunId: canaryOne,
      actorOwnerId: "admin-1",
    })).rejects.toMatchObject({ code: "schedule-interval-too-frequent" });
    expect(execute).not.toHaveBeenCalled();
  });

  it("requires an exact profile for the Tier 2 partner definition", async () => {
    await expect(configurePipelineSchedule({
      definitionKey: "tier2-partner",
      enabled: true,
      intervalMinutes: 1440,
      canaryRunId: canaryOne,
      actorOwnerId: "admin-1",
    })).rejects.toMatchObject({
      code: "schedule-profile-required",
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it("rejects a disabled or missing Tier 2 profile before checking its canary", async () => {
    execute.mockResolvedValueOnce([]);
    await expect(configurePipelineSchedule({
      definitionKey: "tier2-partner",
      sourceProfileId: profileOne,
      enabled: true,
      intervalMinutes: 1440,
      canaryRunId: canaryOne,
      actorOwnerId: "admin-1",
    })).rejects.toMatchObject({
      code: "schedule-profile-inactive",
    });
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("stores independent canaries for two active partner profiles", async () => {
    execute
      .mockResolvedValueOnce([{ id: profileOne }])
      .mockResolvedValueOnce([{
        id: canaryOne,
        exactInputs: tier2ExactInputs(profileOne, connectionOne, "canary-one"),
      }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: profileTwo }])
      .mockResolvedValueOnce([{
        id: canaryTwo,
        exactInputs: tier2ExactInputs(profileTwo, connectionTwo, "canary-two"),
      }])
      .mockResolvedValueOnce([]);

    await configurePipelineSchedule({
      definitionKey: "tier2-partner",
      sourceProfileId: profileOne,
      enabled: true,
      intervalMinutes: 1440,
      canaryRunId: canaryOne,
      actorOwnerId: "admin-1",
    });
    const firstCanaryProjection = JSON.stringify(execute.mock.calls[1]);
    expect(firstCanaryProjection).toContain("exact_inputs as");
    expect(firstCanaryProjection).toContain("exactInputs");
    vi.mocked(snapshotCurrentPipelineInputs).mockResolvedValue(
      tier2ExactInputs(profileTwo, connectionTwo, "canary-two") as never,
    );
    await configurePipelineSchedule({
      definitionKey: "tier2-partner",
      sourceProfileId: profileTwo,
      enabled: true,
      intervalMinutes: 2880,
      canaryRunId: canaryTwo,
      actorOwnerId: "admin-1",
    });

    expect(execute).toHaveBeenCalledTimes(6);
  });

  it("returns every due profile whose canary still matches the active definition", async () => {
    const definition = getPipelineFlowDefinition("tier2-partner");
    expect(definition).not.toBeNull();
    execute.mockResolvedValueOnce([
      {
        definitionKey: "tier2-partner",
        sourceProfileId: profileOne,
        intervalMinutes: 1440,
        canaryDefinitionVersion: definition!.version,
        canaryDefinitionChecksum: definition!.checksum,
        canaryStatus: "succeeded",
        canaryLaunchKind: "manual",
        canaryExactInputs: tier2ExactInputs(profileOne, connectionOne, "canary-one"),
      },
      {
        definitionKey: "tier2-partner",
        sourceProfileId: profileTwo,
        intervalMinutes: 2880,
        canaryDefinitionVersion: definition!.version,
        canaryDefinitionChecksum: definition!.checksum,
        canaryStatus: "succeeded",
        canaryLaunchKind: "manual",
        canaryExactInputs: tier2ExactInputs(profileTwo, connectionTwo, "canary-two"),
      },
    ]);
    vi.mocked(snapshotCurrentPipelineInputs).mockResolvedValue(
      currentTier2Inputs([
        {
          profileId: profileOne,
          connectionId: connectionOne,
          checksum: "canary-one",
        },
        {
          profileId: profileTwo,
          connectionId: connectionTwo,
          checksum: "canary-two",
        },
      ]) as never,
    );

    await expect(getDuePipelineSchedules()).resolves.toEqual([
      {
        definitionKey: "tier2-partner",
        sourceProfileId: profileOne,
        intervalMinutes: 1440,
        canaryExactInputs: tier2ExactInputs(profileOne, connectionOne, "canary-one"),
      },
      {
        definitionKey: "tier2-partner",
        sourceProfileId: profileTwo,
        intervalMinutes: 2880,
        canaryExactInputs: tier2ExactInputs(profileTwo, connectionTwo, "canary-two"),
      },
    ]);
  });

  it("does not enqueue a due Tier 2 schedule after its profile contract changes", async () => {
    const definition = getPipelineFlowDefinition("tier2-partner")!;
    execute.mockResolvedValueOnce([{
      definitionKey: "tier2-partner",
      sourceProfileId: profileOne,
      intervalMinutes: 1440,
      canaryDefinitionVersion: definition.version,
      canaryDefinitionChecksum: definition.checksum,
      canaryStatus: "succeeded",
      canaryLaunchKind: "manual",
      canaryExactInputs: tier2ExactInputs(
        profileOne,
        connectionOne,
        "canary-one",
        "old-profile-contract",
      ),
    }]);

    await expect(getDuePipelineSchedules()).resolves.toEqual([]);
    expect(snapshotCurrentPipelineInputs).toHaveBeenCalledOnce();
  });

  it("does not enqueue a schedule after its canary definition drifts or loses success", async () => {
    const definition = getPipelineFlowDefinition("tier2-partner");
    execute.mockResolvedValueOnce([
      {
        definitionKey: "tier2-partner",
        sourceProfileId: profileOne,
        intervalMinutes: 1440,
        canaryDefinitionVersion: definition!.version,
        canaryDefinitionChecksum: "f".repeat(64),
        canaryStatus: "succeeded",
        canaryLaunchKind: "manual",
        canaryExactInputs: tier2ExactInputs(profileOne, connectionOne, "old"),
      },
      {
        definitionKey: "tier2-partner",
        sourceProfileId: profileTwo,
        intervalMinutes: 2880,
        canaryDefinitionVersion: definition!.version,
        canaryDefinitionChecksum: definition!.checksum,
        canaryStatus: "failed",
        canaryLaunchKind: "manual",
        canaryExactInputs: tier2ExactInputs(profileTwo, connectionTwo, "canary-two"),
      },
    ]);

    await expect(getDuePipelineSchedules()).resolves.toEqual([]);
  });

  it("rejects schedule enablement after a Sheet tab configuration changed", async () => {
    execute
      .mockResolvedValueOnce([{ id: profileOne }])
      .mockResolvedValueOnce([{
        id: canaryOne,
        exactInputs: tier2ExactInputs(profileOne, connectionOne, "old-tab"),
      }]);

    await expect(configurePipelineSchedule({
      definitionKey: "tier2-partner",
      sourceProfileId: profileOne,
      enabled: true,
      intervalMinutes: 1440,
      canaryRunId: canaryOne,
      actorOwnerId: "admin-1",
    })).rejects.toMatchObject({ code: "schedule-canary-inputs-stale" });
    expect(execute).toHaveBeenCalledTimes(2);
  });
});
