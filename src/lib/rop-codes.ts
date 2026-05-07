import generatedRopCodes from "@/data/rop-codes.generated.json";

export const HIS_ROP_SOURCE_URL = "https://hisregistries.org/rop/";
export const HIS_ROP_FEATURE_SERVER_URL =
  "https://services2.arcgis.com/S4ydGgujXcif36k3/arcgis/rest/services/ROP/FeatureServer";

const ARCGIS_PAGE_SIZE = 1000;
const REQUEST_TIMEOUT_MS = 20000;

const MIN_COUNTS = {
  rop1: 17,
  rop2: 290,
  rop25: 9000,
  rop3: 13000,
  geoIndex: 21000,
} as const;

type RopMinimumCounts = Record<keyof typeof MIN_COUNTS, number>;

export type RopJoinIssue =
  | "missing-rop25"
  | "rop2-conflict"
  | "parent-only-rop25";

export type RopTerm = {
  code: string;
  name: string | null;
  display: string;
};

export type RopTermDetail = RopTerm & {
  description: string | null;
};

export type RopCodeEntry = {
  id: string;
  rowType: "rop3-person" | "rop25-parent";
  rop1: RopTerm | null;
  rop2: RopTerm | null;
  rop25: RopTerm | null;
  rop3: RopTerm | null;
  status: "Active" | "Inactive";
  place: string | null;
  language: string | null;
  source: string | null;
  ethnicId: string | null;
  directRop2: string | null;
  joinIssue: RopJoinIssue | null;
  joinIssueLabel: string | null;
};

export type RopGeoIndexEntry = {
  geoId: number;
  rop3: string;
  rog: string | null;
  geoName: string | null;
  peopleName: string | null;
  peopleId3: string | null;
  isoAlpha3: string | null;
  status: "Active" | "Inactive";
};

export type RopCodeResource = {
  sourceName: string;
  sourceUrl: string;
  featureServerUrl: string;
  sourceRetrievedAt: string;
  entryCount: number;
  rop1Count: number;
  rop2Count: number;
  rop25Count: number;
  rop3Count: number;
  geoIndexCount: number;
  joinIssueCounts: Record<RopJoinIssue, number>;
  rop1DetailsByCode: Record<string, RopTermDetail>;
  rop2DetailsByCode: Record<string, RopTermDetail>;
  rop25DetailsByCode: Record<string, RopTermDetail>;
  rop3DetailsByCode: Record<string, RopTermDetail>;
  entries: RopCodeEntry[];
  geoIndexByRop3: Record<string, RopGeoIndexEntry[]>;
};

type Rop1Record = {
  code: string;
  status: number;
  name: string;
  description: string | null;
};

type Rop2Record = {
  code: string;
  status: number;
  name: string;
  description: string | null;
  rop1: string;
};

type Rop25Record = {
  code: string;
  status: number;
  name: string;
  description: string | null;
  rop2: string;
};

type Rop3Record = {
  code: string;
  status: number;
  name: string;
  description: string | null;
  source: string | null;
  rop25: string;
  rop2: string | null;
  ethnicId: string | null;
  place: string | null;
  language: string | null;
};

export type RopSourceTables = {
  rop1: Rop1Record[];
  rop2: Rop2Record[];
  rop25: Rop25Record[];
  rop3: Rop3Record[];
  geoIndex: RopGeoIndexEntry[];
};

type ArcgisFeature = {
  attributes?: unknown;
};

type ArcgisPage = {
  error?: {
    message?: string;
  };
  features?: ArcgisFeature[];
};

const joinIssueLabels: Record<RopJoinIssue, string> = {
  "missing-rop25": "ROP25 code is not listed in the ROP25 table",
  "parent-only-rop25": "ROP25 code has no ROP3 child",
  "rop2-conflict": "ROP3 direct ROP2 differs from the ROP25 parent chain",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requiredString(value: unknown, label: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`ROP source row is missing ${label}.`);
  }

  return value.trim();
}

function optionalString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function requiredNumber(value: unknown, label: string) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`ROP source row is missing numeric ${label}.`);
  }

  return value;
}

function numericCode(value: unknown, label: string) {
  const numberValue = requiredNumber(value, label);

  if (!Number.isInteger(numberValue)) {
    throw new Error(`ROP source row has non-integer ${label}.`);
  }

  return String(numberValue);
}

function statusLabel(status: number) {
  return status === 1 ? "Active" : "Inactive";
}

function validateCode(value: string, pattern: RegExp, label: string) {
  if (!pattern.test(value)) {
    throw new Error(`Invalid ${label}: ${value}.`);
  }
}

function requireMinimumCount<T>(
  rows: T[],
  minimumCount: number,
  label: string,
) {
  if (rows.length < minimumCount) {
    throw new Error(
      `${label} returned ${rows.length} rows; expected at least ${minimumCount}.`,
    );
  }
}

function uniqueBy<T>(rows: T[], getKey: (row: T) => string, label: string) {
  const seen = new Set<string>();

  for (const row of rows) {
    const key = getKey(row);

    if (seen.has(key)) {
      throw new Error(`Duplicate ${label}: ${key}.`);
    }

    seen.add(key);
  }
}

function buildTerm(input: {
  code: string;
  name: string | null;
}): RopTerm {
  return {
    code: input.code,
    name: input.name,
    display: input.name ? `${input.code} - ${input.name}` : `${input.code} - Not listed`,
  };
}

function buildTermDetail(input: {
  code: string;
  name: string | null;
  description: string | null;
}): RopTermDetail {
  return {
    ...buildTerm(input),
    description: input.description,
  };
}

function parseRop1(attributes: Record<string, unknown>): Rop1Record {
  const code = requiredString(attributes.ROP1, "ROP1");

  validateCode(code, /^A\d{3}$/, "ROP1");

  return {
    code,
    status: requiredNumber(attributes.Status, "Status"),
    name: requiredString(attributes.AffinityBloc, "AffinityBloc"),
    description: optionalString(attributes.Description),
  };
}

function parseRop2(attributes: Record<string, unknown>): Rop2Record {
  const code = requiredString(attributes.ROP2, "ROP2");
  const rop1 = requiredString(attributes.ROP1, "ROP1");

  validateCode(code, /^C\d{4}$/, "ROP2");
  validateCode(rop1, /^A\d{3}$/, "ROP1");

  return {
    code,
    status: requiredNumber(attributes.Status, "Status"),
    name: requiredString(attributes.PeopleCluster, "PeopleCluster"),
    description: optionalString(attributes.Description),
    rop1,
  };
}

function parseRop25(attributes: Record<string, unknown>): Rop25Record {
  const code = numericCode(attributes.ROP25, "ROP25");
  const rop2 = requiredString(attributes.ROP2, "ROP2");

  validateCode(code, /^\d{6}$/, "ROP25");
  validateCode(rop2, /^C\d{4}$/, "ROP2");

  return {
    code,
    status: requiredNumber(attributes.Status, "Status"),
    name: requiredString(attributes.KinshipGroup, "KinshipGroup"),
    description: optionalString(attributes.Description),
    rop2,
  };
}

function parseRop3(attributes: Record<string, unknown>): Rop3Record {
  const code = numericCode(attributes.ROP3, "ROP3");
  const rop25 = numericCode(attributes.ROP25, "ROP25");
  const rop2 = optionalString(attributes.ROP2);

  validateCode(code, /^\d{6}$/, "ROP3");
  validateCode(rop25, /^\d{6}$/, "ROP25");

  if (rop2) {
    validateCode(rop2, /^C\d{4}$/, "ROP2");
  }

  return {
    code,
    status: requiredNumber(attributes.Status, "Status"),
    name: requiredString(attributes.PeopleName, "PeopleName"),
    description: optionalString(attributes.Description),
    source: optionalString(attributes.Source),
    rop25,
    rop2,
    ethnicId: optionalString(attributes.EthnicID),
    place: optionalString(attributes.PLOC),
    language: optionalString(attributes.PROL),
  };
}

function parseGeoIndex(attributes: Record<string, unknown>): RopGeoIndexEntry {
  const rop3 = numericCode(attributes.ROP3, "ROP3");

  validateCode(rop3, /^\d{6}$/, "ROP3");

  return {
    geoId: requiredNumber(attributes.GeoID, "GeoID"),
    rop3,
    rog: optionalString(attributes.ROG),
    geoName: optionalString(attributes.GeoName),
    peopleName: optionalString(attributes.PeopleName),
    peopleId3:
      typeof attributes.PeopleID3 === "number" && Number.isFinite(attributes.PeopleID3)
        ? String(Math.trunc(attributes.PeopleID3))
        : optionalString(attributes.PeopleID3),
    isoAlpha3: optionalString(attributes.ISOalpha3),
    status: statusLabel(requiredNumber(attributes.status, "status")),
  };
}

function getLayerQueryUrl(input: {
  layerId: number;
  outFields: string;
  offset: number;
}) {
  const url = new URL(`${HIS_ROP_FEATURE_SERVER_URL}/${input.layerId}/query`);

  url.searchParams.set("where", "1=1");
  url.searchParams.set("outFields", input.outFields);
  url.searchParams.set("returnGeometry", "false");
  url.searchParams.set("resultRecordCount", String(ARCGIS_PAGE_SIZE));
  url.searchParams.set("resultOffset", String(input.offset));
  url.searchParams.set("orderByFields", "OBJECTID ASC");
  url.searchParams.set("f", "json");

  return url;
}

async function fetchJson(url: URL) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HIS ROP request failed with HTTP ${response.status}.`);
    }

    const parsed = (await response.json()) as unknown;

    if (!isRecord(parsed)) {
      throw new Error("HIS ROP response was not an object.");
    }

    return parsed as ArcgisPage;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchArcgisAttributes(input: {
  layerId: number;
  outFields: string;
}) {
  const rows: Record<string, unknown>[] = [];
  let offset = 0;

  while (true) {
    const page = await fetchJson(
      getLayerQueryUrl({
        ...input,
        offset,
      }),
    );

    if (page.error) {
      throw new Error(page.error.message ?? "HIS ROP API returned an error.");
    }

    if (!Array.isArray(page.features)) {
      throw new Error("HIS ROP response did not include features.");
    }

    const attributes = page.features.map((feature) => {
      if (!isRecord(feature.attributes)) {
        throw new Error("HIS ROP feature is missing attributes.");
      }

      return feature.attributes;
    });

    rows.push(...attributes);

    if (attributes.length < ARCGIS_PAGE_SIZE) {
      break;
    }

    offset += ARCGIS_PAGE_SIZE;
  }

  return rows;
}

export async function fetchRopSourceTables(): Promise<RopSourceTables> {
  const [rop1, rop2, rop25, rop3, geoIndex] = await Promise.all([
    fetchArcgisAttributes({
      layerId: 1,
      outFields: "ROP1,Status,AffinityBloc,Description",
    }).then((rows) => rows.map(parseRop1)),
    fetchArcgisAttributes({
      layerId: 2,
      outFields: "ROP2,Status,PeopleCluster,Description,ROP1",
    }).then((rows) => rows.map(parseRop2)),
    fetchArcgisAttributes({
      layerId: 3,
      outFields: "ROP25,Status,KinshipGroup,Description,ROP2",
    }).then((rows) => rows.map(parseRop25)),
    fetchArcgisAttributes({
      layerId: 4,
      outFields:
        "ROP3,PeopleName,Description,Source,ROP25,ROP2,EthnicID,PLOC,PROL,Status",
    }).then((rows) => rows.map(parseRop3)),
    fetchArcgisAttributes({
      layerId: 0,
      outFields: "GeoID,ROP3,ROG,GeoName,PeopleName,PeopleID3,ISOalpha3,status",
    }).then((rows) => rows.map(parseGeoIndex)),
  ]);

  return {
    rop1,
    rop2,
    rop25,
    rop3,
    geoIndex,
  };
}

function validateSourceTables(
  tables: RopSourceTables,
  minimumCounts: RopMinimumCounts,
) {
  requireMinimumCount(tables.rop1, minimumCounts.rop1, "ROP1");
  requireMinimumCount(tables.rop2, minimumCounts.rop2, "ROP2");
  requireMinimumCount(tables.rop25, minimumCounts.rop25, "ROP25");
  requireMinimumCount(tables.rop3, minimumCounts.rop3, "ROP3");
  requireMinimumCount(tables.geoIndex, minimumCounts.geoIndex, "ROP3GeoIndex");
  uniqueBy(tables.rop1, (row) => row.code, "ROP1");
  uniqueBy(tables.rop2, (row) => row.code, "ROP2");
  uniqueBy(tables.rop25, (row) => row.code, "ROP25");
  uniqueBy(tables.rop3, (row) => row.code, "ROP3");

  const rop1Codes = new Set(tables.rop1.map((row) => row.code));
  const rop2Codes = new Set(tables.rop2.map((row) => row.code));

  for (const row of tables.rop2) {
    if (!rop1Codes.has(row.rop1)) {
      throw new Error(`ROP2 ${row.code} references missing ROP1 ${row.rop1}.`);
    }
  }

  for (const row of tables.rop25) {
    if (!rop2Codes.has(row.rop2)) {
      throw new Error(`ROP25 ${row.code} references missing ROP2 ${row.rop2}.`);
    }
  }
}

function issueLabel(issue: RopJoinIssue | null) {
  return issue ? joinIssueLabels[issue] : null;
}

function compareTerm(left: RopTerm | null, right: RopTerm | null) {
  return (left?.code ?? "ZZZZZZ").localeCompare(right?.code ?? "ZZZZZZ");
}

function compareEntries(left: RopCodeEntry, right: RopCodeEntry) {
  return (
    compareTerm(left.rop1, right.rop1) ||
    compareTerm(left.rop2, right.rop2) ||
    compareTerm(left.rop25, right.rop25) ||
    compareTerm(left.rop3, right.rop3) ||
    left.id.localeCompare(right.id)
  );
}

export function buildRopCodeResource(
  tables: RopSourceTables,
  sourceRetrievedAt = new Date().toISOString(),
  minimumCounts: RopMinimumCounts = MIN_COUNTS,
): RopCodeResource {
  validateSourceTables(tables, minimumCounts);

  const rop1ByCode = new Map(tables.rop1.map((row) => [row.code, row]));
  const rop2ByCode = new Map(tables.rop2.map((row) => [row.code, row]));
  const rop25ByCode = new Map(tables.rop25.map((row) => [row.code, row]));
  const rop3Rop25Codes = new Set(tables.rop3.map((row) => row.rop25));
  const joinIssueCounts: Record<RopJoinIssue, number> = {
    "missing-rop25": 0,
    "parent-only-rop25": 0,
    "rop2-conflict": 0,
  };

  const entries = tables.rop3.map((row): RopCodeEntry => {
    const rop25 = rop25ByCode.get(row.rop25) ?? null;
    let joinIssue: RopJoinIssue | null = null;
    let rop2 = rop25 ? rop2ByCode.get(rop25.rop2) ?? null : null;

    if (!rop25) {
      joinIssue = "missing-rop25";
      rop2 = row.rop2 ? rop2ByCode.get(row.rop2) ?? null : null;
    } else if (row.rop2 && row.rop2 !== rop25.rop2) {
      joinIssue = "rop2-conflict";
    }

    if (joinIssue) {
      joinIssueCounts[joinIssue] += 1;
    }

    const rop1 = rop2 ? rop1ByCode.get(rop2.rop1) ?? null : null;

    return {
      id: `rop3-${row.code}`,
      rowType: "rop3-person",
      rop1: rop1
        ? buildTerm({
            code: rop1.code,
            name: rop1.name,
          })
        : null,
      rop2: rop2
        ? buildTerm({
            code: rop2.code,
            name: rop2.name,
          })
        : null,
      rop25: buildTerm({
        code: row.rop25,
        name: rop25?.name ?? null,
      }),
      rop3: buildTerm({
        code: row.code,
        name: row.name,
      }),
      status: statusLabel(row.status),
      place: row.place,
      language: row.language,
      source: row.source,
      ethnicId: row.ethnicId,
      directRop2: row.rop2,
      joinIssue,
      joinIssueLabel: issueLabel(joinIssue),
    };
  });

  for (const row of tables.rop25) {
    if (rop3Rop25Codes.has(row.code)) {
      continue;
    }

    const rop2 = rop2ByCode.get(row.rop2) ?? null;
    const rop1 = rop2 ? rop1ByCode.get(rop2.rop1) ?? null : null;

    joinIssueCounts["parent-only-rop25"] += 1;
    entries.push({
      id: `rop25-${row.code}`,
      rowType: "rop25-parent",
      rop1: rop1
        ? buildTerm({
            code: rop1.code,
            name: rop1.name,
          })
        : null,
      rop2: rop2
        ? buildTerm({
            code: rop2.code,
            name: rop2.name,
          })
        : null,
      rop25: buildTerm({
        code: row.code,
        name: row.name,
      }),
      rop3: null,
      status: statusLabel(row.status),
      place: null,
      language: null,
      source: null,
      ethnicId: null,
      directRop2: null,
      joinIssue: "parent-only-rop25",
      joinIssueLabel: issueLabel("parent-only-rop25"),
    });
  }

  const geoIndexByRop3: Record<string, RopGeoIndexEntry[]> = {};

  for (const row of tables.geoIndex) {
    geoIndexByRop3[row.rop3] ??= [];
    geoIndexByRop3[row.rop3].push(row);
  }

  for (const rows of Object.values(geoIndexByRop3)) {
    rows.sort((left, right) =>
      [left.isoAlpha3 ?? "", left.geoName ?? "", String(left.geoId)].join(":").localeCompare(
        [right.isoAlpha3 ?? "", right.geoName ?? "", String(right.geoId)].join(":"),
      ),
    );
  }

  entries.sort(compareEntries);

  return {
    sourceName: "HIS Registry of Peoples",
    sourceUrl: HIS_ROP_SOURCE_URL,
    featureServerUrl: HIS_ROP_FEATURE_SERVER_URL,
    sourceRetrievedAt,
    entryCount: entries.length,
    rop1Count: tables.rop1.length,
    rop2Count: tables.rop2.length,
    rop25Count: tables.rop25.length,
    rop3Count: tables.rop3.length,
    geoIndexCount: tables.geoIndex.length,
    joinIssueCounts,
    rop1DetailsByCode: Object.fromEntries(
      tables.rop1.map((row) => [
        row.code,
        buildTermDetail({
          code: row.code,
          name: row.name,
          description: row.description,
        }),
      ]),
    ),
    rop2DetailsByCode: Object.fromEntries(
      tables.rop2.map((row) => [
        row.code,
        buildTermDetail({
          code: row.code,
          name: row.name,
          description: row.description,
        }),
      ]),
    ),
    rop25DetailsByCode: Object.fromEntries(
      tables.rop25.map((row) => [
        row.code,
        buildTermDetail({
          code: row.code,
          name: row.name,
          description: row.description,
        }),
      ]),
    ),
    rop3DetailsByCode: Object.fromEntries(
      tables.rop3.map((row) => [
        row.code,
        buildTermDetail({
          code: row.code,
          name: row.name,
          description: row.description,
        }),
      ]),
    ),
    entries,
    geoIndexByRop3,
  };
}

export async function refreshRopCodeResourceFromHis() {
  return buildRopCodeResource(await fetchRopSourceTables());
}

export function getGeneratedRopCodeResource() {
  return generatedRopCodes as RopCodeResource;
}
