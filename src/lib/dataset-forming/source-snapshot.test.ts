import { describe, expect, it } from "vitest";
import { checksumSourceFormingValue } from "@/lib/source-forming";

import {
  createApiConnectionSourceProfileSnapshot,
  resolveApiConnectionSourceProfileSnapshot,
} from "./source-snapshot";

describe("API connection source-profile snapshots", () => {
  it("pins the complete registered profile and engine configuration", () => {
    const created = createApiConnectionSourceProfileSnapshot({
      connectionId: "connection-1",
      sourceProfile: {
        key: "wcd-people-groups",
        engineKey: "wcd",
        label: "World Christian Database forming",
        stableKeyColumn: "Record ID",
        configurable: true,
      },
    });

    expect(created.snapshot).toMatchObject({
      schemaVersion: 1,
      connectionId: "connection-1",
      sourceProfileKey: "wcd-people-groups",
      stableKeyColumn: "Record ID",
      engineKey: "wcd",
      engineLabel: "World Christian Database forming",
    });
    expect(created.checksum).toMatch(/^[0-9a-f]{64}$/u);
    expect(
      resolveApiConnectionSourceProfileSnapshot({
        connectionId: "connection-1",
        snapshot: created.snapshot,
        checksum: created.checksum,
      }).engine.engineKey,
    ).toBe("wcd");
  });

  it("fails closed for missing, changed, or incompatible snapshots", () => {
    const created = createApiConnectionSourceProfileSnapshot({
      connectionId: "connection-1",
      sourceProfile: {
        key: "wcd-people-groups",
        engineKey: "wcd",
        label: "World Christian Database forming",
        stableKeyColumn: "Record ID",
        configurable: true,
      },
    });

    expect(() =>
      resolveApiConnectionSourceProfileSnapshot({
        connectionId: "connection-1",
        snapshot: null,
        checksum: null,
      }),
    ).toThrow("predates immutable source-profile snapshots");
    expect(() =>
      resolveApiConnectionSourceProfileSnapshot({
        connectionId: "connection-1",
        snapshot: {
          ...created.snapshot,
          stableKeyColumn: "Later Rebind ID",
        },
        checksum: created.checksum,
      }),
    ).toThrow("snapshot checksum is invalid");
    const incompatibleSnapshot = {
      ...created.snapshot,
      engineVersion: "removed-engine-version",
    };
    expect(() =>
      resolveApiConnectionSourceProfileSnapshot({
        connectionId: "connection-1",
        snapshot: incompatibleSnapshot,
        checksum: checksumSourceFormingValue(incompatibleSnapshot),
      }),
    ).toThrow("deployed forming engine is incompatible");
  });
});
