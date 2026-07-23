import { describe, expect, it, vi } from "vitest";

import { getDb } from "@/db";
import {
  ETNOPEDIA_API_CONNECTION_ID,
  JOSHUA_PROJECT_API_CONNECTION_ID,
  getCodeManagedSourceProfile,
  resolveSourceProfile,
  upsertSourceProfileBinding,
} from "@/lib/source-profiles";

vi.mock("@/db", () => ({ getDb: vi.fn() }));

describe("source profiles", () => {
  it("exposes stable code-managed metadata", async () => {
    expect(getCodeManagedSourceProfile(ETNOPEDIA_API_CONNECTION_ID)).toEqual({
      key: "etnopedia-people-groups",
      engineKey: "etnopedia",
      label: "Etnopedia forming",
      stableKeyColumn: null,
      configurable: false,
    });
    expect(
      getCodeManagedSourceProfile(JOSHUA_PROJECT_API_CONNECTION_ID)?.engineKey,
    ).toBe("joshua-project");
    await expect(resolveSourceProfile(ETNOPEDIA_API_CONNECTION_ID)).resolves.toMatchObject({
      key: "etnopedia-people-groups",
    });
    expect(getDb).not.toHaveBeenCalled();
  });

  it("rejects a configurable profile without a durable key", async () => {
    await expect(
      upsertSourceProfileBinding({
        connectionId: "connection-1",
        sourceProfileKey: "wcd-people-groups",
        stableKeyColumn: "  ",
        actorOwnerId: "owner-1",
      }),
    ).rejects.toThrow("durable stable-key column");
    expect(getDb).not.toHaveBeenCalled();
  });

  it("maps a duplicate source-profile assignment to a stable conflict", async () => {
    const limit = vi.fn().mockResolvedValue([
      { provider: "google_sheets", archivedAt: null },
    ]);
    const selectDb = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({ limit })),
        })),
      })),
    };
    const duplicate = Object.assign(new Error("duplicate detail"), {
      code: "23505",
    });
    const insertDb = {
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          onConflictDoUpdate: vi.fn(() => ({
            returning: vi.fn().mockRejectedValue(duplicate),
          })),
        })),
      })),
    };
    vi.mocked(getDb)
      .mockReturnValueOnce(selectDb as never)
      .mockReturnValueOnce(insertDb as never);

    await expect(
      upsertSourceProfileBinding({
        connectionId: "connection-2",
        sourceProfileKey: "wcd-people-groups",
        stableKeyColumn: "Record ID",
        actorOwnerId: "owner-1",
      }),
    ).rejects.toMatchObject({
      code: "source-profile-already-bound",
      sourceProfileKey: "wcd-people-groups",
    });
  });
});
