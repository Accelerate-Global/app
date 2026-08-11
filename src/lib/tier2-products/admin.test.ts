import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({ getDb: vi.fn() }));

import { getDb } from "@/db";

import {
  listTier2GoogleSheetConnections,
  refreshTier2PartnerProfileSheetTitleFromConnection,
} from "./admin";

describe("Tier 2 partner administration", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists only non-archived Google Sheets connections using the live connection schema", async () => {
    const execute = vi.fn().mockResolvedValue([
      {
        id: "11000000-0000-4000-8000-000000000001",
        name: "Partner source",
        provider_config: {
          provider: "google_sheets",
          spreadsheetId: "sheet-1",
          sheetId: 7,
        },
      },
    ]);
    vi.mocked(getDb).mockReturnValue({ execute } as never);

    await expect(listTier2GoogleSheetConnections()).resolves.toEqual([
      {
        id: "11000000-0000-4000-8000-000000000001",
        name: "Partner source",
        providerConfig: {
          provider: "google_sheets",
          spreadsheetId: "sheet-1",
          sheetId: 7,
        },
      },
    ]);

    const statement = execute.mock.calls[0]![0];
    const query = new PgDialect().sqlToQuery(statement);
    expect(query.sql).toContain("provider = 'google_sheets'");
    expect(query.sql).toContain("archived_at is null");
    expect(query.sql).not.toMatch(/\band active\b/u);
  });

  it("refreshes only the mutable Sheet title while retaining spreadsheet and sheet IDs", async () => {
    const profile = {
      id: "11000000-0000-4000-8000-000000000010",
      profile_key: "partner-alpha",
      partner_key: "alpha",
      display_name: "Partner Alpha",
      api_connection_id: "11000000-0000-4000-8000-000000000001",
      spreadsheet_id: "sheet-1",
      sheet_id: 7,
      sheet_title: "Old title",
      stable_row_key_column: "row_id",
      tracking_id_column: "people_id",
      tracking_id_source: "peopleid3",
      tracking_id_source_column: null,
      tracking_id_source_mappings: [],
      source_rop3_column: null,
      source_country_column: null,
      source_iso3_column: null,
      contract_version: "1",
      contract_checksum: "a".repeat(64),
      active: true,
      created_by_owner_id: "admin",
      updated_by_owner_id: "admin",
      created_at: "2026-07-22T00:00:00.000Z",
      updated_at: "2026-07-22T00:00:00.000Z",
    };
    const execute = vi.fn()
      .mockResolvedValueOnce([{
        ...profile,
        connection_provider: "google_sheets",
        connection_provider_config: {
          provider: "google_sheets",
          spreadsheetId: "sheet-1",
          sheetId: 7,
          sheetTitle: "  Renamed   tab  ",
        },
      }])
      .mockResolvedValueOnce([{ ...profile, sheet_title: "Renamed tab" }]);
    vi.mocked(getDb).mockReturnValue({ execute } as never);

    await expect(refreshTier2PartnerProfileSheetTitleFromConnection({
      profileId: profile.id,
      connectionId: profile.api_connection_id,
    })).resolves.toMatchObject({
      spreadsheetId: "sheet-1",
      sheetId: 7,
      sheetTitle: "Renamed tab",
    });

    const update = new PgDialect().sqlToQuery(execute.mock.calls[1]![0]);
    expect(update.sql).toContain("set sheet_title =");
    expect(update.sql).toContain("and spreadsheet_id =");
    expect(update.sql).toContain("and sheet_id =");
  });
});
