import generatedIsoCountryCodes from "@/data/iso-country-codes.generated.json";

export const ISO_COUNTRY_CODES_SOURCE_URL =
  "https://www.iso.org/obp/ui/#search/code/";
export const ISO_COUNTRY_CODES_COLLECTION_URL =
  "https://www.iso.org/publication/PUB500001.html";
export const ISO_COUNTRY_CODES_MINIMUM_COUNT = 240;

export type IsoCountryCodeEntry = {
  alpha2: string;
  alpha3: string;
  englishShortName: string;
  numeric: string;
  uri: string;
};

export type IsoCountryCodeResource = {
  sourceName: string;
  sourceUrl: string;
  sourceRetrievedAt: string;
  sourceCollectionUrl: string;
  entryCount: number;
  entries: IsoCountryCodeEntry[];
};

type VaadinMessage = {
  "Vaadin-Security-Key"?: string;
  syncId?: number;
  clientId?: number;
  state?: Record<string, { caption?: string; enabled?: boolean; text?: string }>;
  rpc?: unknown[];
};

const GRID_FIELD_IDS = {
  alpha2: "144",
  englishShortName: "148",
  numeric: "162",
  alpha3: "166",
  uri: "164",
  codeType: "142",
  status: "176",
} as const;

function assertString(value: unknown, label: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`ISO country code entry is missing ${label}.`);
  }

  return value.trim();
}

export function validateIsoCountryCodeEntries(
  entries: IsoCountryCodeEntry[],
  minimumCount = ISO_COUNTRY_CODES_MINIMUM_COUNT,
) {
  if (entries.length < minimumCount) {
    throw new Error(
      `ISO country code refresh returned ${entries.length} entries; expected at least ${minimumCount}.`,
    );
  }

  const alpha2Values = new Set<string>();
  const alpha3Values = new Set<string>();

  for (const entry of entries) {
    if (!/^[A-Z]{2}$/.test(entry.alpha2)) {
      throw new Error(`Invalid ISO alpha-2 code: ${entry.alpha2}`);
    }

    if (!/^[A-Z]{3}$/.test(entry.alpha3)) {
      throw new Error(`Invalid ISO alpha-3 code: ${entry.alpha3}`);
    }

    if (!/^\d{3}$/.test(entry.numeric)) {
      throw new Error(`Invalid ISO numeric code for ${entry.alpha3}.`);
    }

    if (!entry.uri.startsWith("iso:code:3166:")) {
      throw new Error(`Invalid ISO source URI for ${entry.alpha3}.`);
    }

    if (alpha2Values.has(entry.alpha2)) {
      throw new Error(`Duplicate ISO alpha-2 code: ${entry.alpha2}`);
    }

    if (alpha3Values.has(entry.alpha3)) {
      throw new Error(`Duplicate ISO alpha-3 code: ${entry.alpha3}`);
    }

    alpha2Values.add(entry.alpha2);
    alpha3Values.add(entry.alpha3);
  }
}

function sortIsoCountryCodeEntries(entries: IsoCountryCodeEntry[]) {
  return [...entries].sort((a, b) =>
    a.englishShortName.localeCompare(b.englishShortName, "en", {
      sensitivity: "base",
    }),
  );
}

export function buildIsoCountryCodeResource(input: {
  entries: IsoCountryCodeEntry[];
  sourceRetrievedAt?: string;
}): IsoCountryCodeResource {
  const entries = sortIsoCountryCodeEntries(input.entries);
  validateIsoCountryCodeEntries(entries);

  return {
    sourceName: "ISO Online Browsing Platform",
    sourceUrl: ISO_COUNTRY_CODES_SOURCE_URL,
    sourceCollectionUrl: ISO_COUNTRY_CODES_COLLECTION_URL,
    sourceRetrievedAt: input.sourceRetrievedAt ?? new Date().toISOString(),
    entryCount: entries.length,
    entries,
  };
}

export function getGeneratedIsoCountryCodeResource(): IsoCountryCodeResource {
  const resource = generatedIsoCountryCodes as IsoCountryCodeResource;
  validateIsoCountryCodeEntries(resource.entries);

  if (resource.entryCount !== resource.entries.length) {
    throw new Error("Generated ISO country code entry count is stale.");
  }

  return resource;
}

function getSetCookies(headers: Headers) {
  const maybeGetSetCookie = (
    headers as Headers & { getSetCookie?: () => string[] }
  ).getSetCookie;

  if (typeof maybeGetSetCookie === "function") {
    return maybeGetSetCookie.call(headers);
  }

  const cookieHeader = headers.get("set-cookie");
  return cookieHeader ? cookieHeader.split(/,(?=\s*[^;,]+=)/) : [];
}

function mergeCookies(currentCookies: Map<string, string>, headers: Headers) {
  for (const cookie of getSetCookies(headers)) {
    const [nameValue] = cookie.split(";");
    const separatorIndex = nameValue.indexOf("=");

    if (separatorIndex > 0) {
      currentCookies.set(
        nameValue.slice(0, separatorIndex).trim(),
        nameValue.slice(separatorIndex + 1).trim(),
      );
    }
  }
}

function serializeCookies(cookies: Map<string, string>) {
  return [...cookies.entries()]
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

function getBrowserDetailsBody() {
  const now = Date.now();
  const body = new URLSearchParams({
    "v-browserDetails": "1",
    theme: "iso-red",
    "v-appId": "obpui-105541713",
    browserDetails: "1",
    screenWidth: "1280",
    screenHeight: "720",
    windowWidth: "1280",
    windowHeight: "720",
    "v-loc": ISO_COUNTRY_CODES_SOURCE_URL,
    "v-wn": "obpui-105541713",
    "v-tzo": "0",
    "v-dstd": "0",
    "v-rtzo": "0",
    "v-dston": "false",
    "v-vw": "1280",
    "v-vh": "720",
    "v-sw": "1280",
    "v-sh": "720",
    "v-cw": "1280",
    "v-ch": "720",
    "v-curdate": String(now),
    "v-tzoffset": "0",
  });

  return { body, now };
}

function parseInitialVaadinMessage(text: string): VaadinMessage {
  const parsed = JSON.parse(text) as { uidl?: string };

  if (typeof parsed.uidl !== "string") {
    throw new Error("ISO OBP initial response did not include UIDL.");
  }

  return JSON.parse(parsed.uidl) as VaadinMessage;
}

function parseVaadinMessages(text: string): VaadinMessage[] {
  return JSON.parse(text.replace(/^for\(;;\);/, "")) as VaadinMessage[];
}

function getRpcEntries(message: VaadinMessage) {
  return Array.isArray(message.rpc) ? message.rpc : [];
}

function readIsoRows(message: VaadinMessage) {
  const entries: IsoCountryCodeEntry[] = [];

  for (const rpc of getRpcEntries(message)) {
    if (!Array.isArray(rpc) || rpc[2] !== "setData") {
      continue;
    }

    const rows = (rpc[3] as unknown[])?.[1];

    if (!Array.isArray(rows)) {
      continue;
    }

    for (const row of rows) {
      const data = (row as { d?: Record<string, unknown> }).d;

      if (
        !data ||
        data[GRID_FIELD_IDS.codeType] !== "country" ||
        data[GRID_FIELD_IDS.status] !== "Officially assigned"
      ) {
        continue;
      }

      entries.push({
        alpha2: assertString(data[GRID_FIELD_IDS.alpha2], "alpha-2 code"),
        alpha3: assertString(data[GRID_FIELD_IDS.alpha3], "alpha-3 code"),
        englishShortName: assertString(
          data[GRID_FIELD_IDS.englishShortName],
          "English short name",
        ),
        numeric: assertString(data[GRID_FIELD_IDS.numeric], "numeric code"),
        uri: assertString(data[GRID_FIELD_IDS.uri], "source URI"),
      });
    }
  }

  return entries;
}

function getCountryDataConnectorId(message: VaadinMessage) {
  for (const rpc of getRpcEntries(message)) {
    if (!Array.isArray(rpc) || rpc[2] !== "setData") {
      continue;
    }

    const rows = (rpc[3] as unknown[])?.[1];

    if (
      Array.isArray(rows) &&
      rows.some((row) => {
        const data = (row as { d?: Record<string, unknown> }).d;
        return (
          data?.[GRID_FIELD_IDS.codeType] === "country" &&
          data?.[GRID_FIELD_IDS.status] === "Officially assigned"
        );
      })
    ) {
      return String(rpc[0]);
    }
  }

  return null;
}

function findEnabledNextButtonId(message: VaadinMessage) {
  const state = message.state ?? {};
  const nextButtonIds = Object.entries(state)
    .filter(([, value]) => value.caption === "Next" && value.enabled !== false)
    .map(([id]) => Number(id))
    .filter((id) => Number.isFinite(id));

  if (nextButtonIds.length === 0) {
    return null;
  }

  return String(Math.max(...nextButtonIds));
}

function createClickPayload(input: {
  csrfToken: string;
  buttonId: string;
  syncId: number;
  clientId: number;
}) {
  return JSON.stringify({
    csrfToken: input.csrfToken,
    rpc: [
      [
        input.buttonId,
        "com.vaadin.shared.ui.button.ButtonServerRpc",
        "click",
        [
          {
            altKey: false,
            button: "LEFT",
            clientX: 0,
            clientY: 0,
            ctrlKey: false,
            metaKey: false,
            relativeX: 0,
            relativeY: 0,
            shiftKey: false,
            type: 1,
          },
        ],
      ],
    ],
    syncId: input.syncId,
    clientId: input.clientId,
  });
}

function createRowsPayload(input: {
  csrfToken: string;
  dataConnectorId: string;
  syncId: number;
  clientId: number;
}) {
  return JSON.stringify({
    csrfToken: input.csrfToken,
    rpc: [
      [
        input.dataConnectorId,
        "com.vaadin.shared.data.DataCommunicatorServerRpc",
        "requestRows",
        [0, 25, 0, 2],
      ],
    ],
    syncId: input.syncId,
    clientId: input.clientId,
  });
}

async function fetchWithCookies(input: {
  url: string;
  cookies: Map<string, string>;
  init?: RequestInit;
}) {
  const response = await fetch(input.url, {
    ...input.init,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; AccelerateGlobalIsoCountryCodeRefresh/1.0)",
      Accept: "application/json,text/html,*/*",
      Cookie: serializeCookies(input.cookies),
      ...input.init?.headers,
    },
  });

  mergeCookies(input.cookies, response.headers);

  if (!response.ok) {
    throw new Error(`ISO OBP request failed with ${response.status}.`);
  }

  return response.text();
}

export async function refreshIsoCountryCodeResourceFromOfficialSource() {
  const cookies = new Map<string, string>();

  await fetchWithCookies({
    url: "https://www.iso.org/obp/ui/",
    cookies,
  });

  const { body, now } = getBrowserDetailsBody();
  let message = parseInitialVaadinMessage(
    await fetchWithCookies({
      url: `https://www.iso.org/obp/ui/?v-${now}`,
      cookies,
      init: {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        },
        body,
      },
    }),
  );

  const csrfToken = message["Vaadin-Security-Key"];
  const dataConnectorId = getCountryDataConnectorId(message);

  if (!csrfToken || dataConnectorId === null) {
    throw new Error("ISO OBP response did not include refresh session metadata.");
  }

  const entriesByAlpha2 = new Map<string, IsoCountryCodeEntry>();
  let syncId = message.syncId ?? 0;
  let clientId = message.clientId ?? 0;

  function addEntries(nextEntries: IsoCountryCodeEntry[]) {
    for (const entry of nextEntries) {
      entriesByAlpha2.set(entry.alpha2, entry);
    }
  }

  addEntries(readIsoRows(message));

  for (let page = 0; page < 20; page += 1) {
    const nextButtonId = findEnabledNextButtonId(message);

    if (!nextButtonId) {
      break;
    }

    const clickMessages = parseVaadinMessages(
      await fetchWithCookies({
        url: "https://www.iso.org/obp/ui/UIDL/?v-uiId=0",
        cookies,
        init: {
          method: "POST",
          headers: {
            "Content-Type": "application/json; charset=UTF-8",
          },
          body: createClickPayload({
            csrfToken,
            buttonId: nextButtonId,
            syncId,
            clientId,
          }),
        },
      }),
    );

    message = clickMessages[0] ?? {};
    syncId = message.syncId ?? syncId;
    clientId = message.clientId ?? clientId;

    const rowRequestSyncId = syncId;
    const rowRequestClientId = clientId;
    const rowRequestPayload = createRowsPayload({
      csrfToken,
      dataConnectorId,
      syncId: rowRequestSyncId,
      clientId: rowRequestClientId,
    });
    let rowMessages = parseVaadinMessages(
      await fetchWithCookies({
        url: "https://www.iso.org/obp/ui/UIDL/?v-uiId=0",
        cookies,
        init: {
          method: "POST",
          headers: {
            "Content-Type": "application/json; charset=UTF-8",
          },
          body: rowRequestPayload,
        },
      }),
    );

    if (readIsoRows(rowMessages[0] ?? {}).length === 0) {
      rowMessages = parseVaadinMessages(
        await fetchWithCookies({
          url: "https://www.iso.org/obp/ui/UIDL/?v-uiId=0",
          cookies,
          init: {
            method: "POST",
            headers: {
              "Content-Type": "application/json; charset=UTF-8",
            },
            body: rowRequestPayload,
          },
        }),
      );
    }

    message = rowMessages[0] ?? {};
    syncId = message.syncId ?? syncId;
    clientId = message.clientId ?? clientId;
    addEntries(readIsoRows(message));
  }

  return buildIsoCountryCodeResource({
    entries: [...entriesByAlpha2.values()],
  });
}
