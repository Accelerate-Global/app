export type PrivateDataChatIncidentRow = Readonly<{
  peopleId: string;
  country: "Sudan";
  globallyEngaged: boolean | null;
  frontierGroup: boolean | null;
}>;

type IncidentBucket = Readonly<{
  count: number;
  globallyEngaged: boolean | null;
  frontierGroup: boolean | null;
}>;

const INCIDENT_BUCKETS: readonly IncidentBucket[] = [
  { count: 67, globallyEngaged: false, frontierGroup: true },
  { count: 16, globallyEngaged: null, frontierGroup: true },
  { count: 20, globallyEngaged: true, frontierGroup: true },
  { count: 10, globallyEngaged: false, frontierGroup: null },
  { count: 11, globallyEngaged: null, frontierGroup: null },
  { count: 30, globallyEngaged: false, frontierGroup: false },
  { count: 20, globallyEngaged: true, frontierGroup: false },
  { count: 6, globallyEngaged: true, frontierGroup: null },
] as const;

function buildIncidentRows() {
  const rows: PrivateDataChatIncidentRow[] = [];

  for (const bucket of INCIDENT_BUCKETS) {
    for (let index = 0; index < bucket.count; index += 1) {
      rows.push({
        peopleId: `SYNTHETIC-SDN-${String(rows.length + 1).padStart(3, "0")}`,
        country: "Sudan",
        globallyEngaged: bucket.globallyEngaged,
        frontierGroup: bucket.frontierGroup,
      });
    }
  }

  return Object.freeze(rows);
}

export const PRIVATE_DATA_CHAT_SUDAN_INCIDENT_FIXTURE = Object.freeze({
  fixtureKey: "synthetic-sudan-uupg-100-103-104-v1",
  recordLimit: 100,
  expected: Object.freeze({
    totalRows: 180,
    explicitFrontierMatches: 103,
    explicitDualCriterionMatches: 67,
    authoritativeUupgMatches: 104,
  }),
  rows: buildIncidentRows(),
});

export function matchesIncidentUupg(row: PrivateDataChatIncidentRow) {
  return (
    (row.globallyEngaged === false || row.globallyEngaged === null) &&
    (row.frontierGroup === true || row.frontierGroup === null)
  );
}
