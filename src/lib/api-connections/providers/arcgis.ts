import type { ApiConnectionResponseFormat } from "@/lib/api-types";

import {
  ApiConnectionError,
  REQUEST_TIMEOUT_MS,
  alignRowsToColumns,
  apiValueToString,
  fetchWithSafeRedirects,
  isRecord,
  readLimitedResponse,
  rowsToColumns,
} from "../core";
import type { ConnectionProvider } from "../provider";
import {
  adaptCurrentImbArcgisFeatures,
  getImbSourceAdapterMetadata,
  isImbApiConnection,
} from "./imb";

const MAX_ARCGIS_RESPONSE_BYTES = 64 * 1024 * 1024;
const ARCGIS_FEATURE_PAGE_SIZE = 2000;

function isArcgisFeatureServerQueryUrl(value: string) {
  try {
    const url = new URL(value);
    return /\/FeatureServer\/\d+\/query$/i.test(url.pathname);
  } catch {
    return false;
  }
}

function isArcgisFeatureConnection(input: {
  url: string;
  responseFormat: ApiConnectionResponseFormat;
  responseDataPath: string;
}) {
  return (
    input.responseFormat === "json" &&
    input.responseDataPath.trim() === "features" &&
    isArcgisFeatureServerQueryUrl(input.url)
  );
}

function getArcgisFeaturePageUrl(input: {
  url: string;
  pageSize: number;
  offset: number;
  objectIdField: string | null;
}) {
  const url = new URL(input.url);

  if (!url.searchParams.has("where")) {
    url.searchParams.set("where", "1=1");
  }

  if (!url.searchParams.has("outFields")) {
    url.searchParams.set("outFields", "*");
  }

  if (!url.searchParams.has("outSR")) {
    url.searchParams.set("outSR", "4326");
  }

  url.searchParams.set("f", "json");
  url.searchParams.set("resultRecordCount", String(input.pageSize));
  url.searchParams.set("resultOffset", String(input.offset));

  if (input.objectIdField) {
    url.searchParams.set("orderByFields", input.objectIdField);
  }

  return url.toString();
}

function parseArcgisFeaturePage(body: string) {
  let parsed: unknown;

  try {
    parsed = JSON.parse(body);
  } catch {
    throw new ApiConnectionError("ArcGIS API response could not be parsed.", 502);
  }

  if (!isRecord(parsed)) {
    throw new ApiConnectionError("ArcGIS API response was not an object.", 502);
  }

  if (isRecord(parsed.error)) {
    const message =
      typeof parsed.error.message === "string"
        ? parsed.error.message
        : "ArcGIS API returned an error.";
    throw new ApiConnectionError(`ArcGIS API error: ${message}`, 502);
  }

  if (!Array.isArray(parsed.features)) {
    throw new ApiConnectionError("ArcGIS API response did not include features.", 502);
  }

  const features = parsed.features.filter(isRecord);

  if (features.length !== parsed.features.length) {
    throw new ApiConnectionError("ArcGIS API response included invalid features.", 502);
  }

  return {
    features,
    objectIdField:
      typeof parsed.objectIdFieldName === "string"
        ? parsed.objectIdFieldName
        : null,
    exceededTransferLimit: parsed.exceededTransferLimit === true,
  };
}

export async function fetchArcgisFeaturePages(input: {
  url: string;
  headers: Headers;
  pageSize?: number;
  maxBytes?: number;
  log?: (message: string) => Promise<void>;
  onHttpStatus?: (status: number) => void;
  fetchSafe?: typeof fetchWithSafeRedirects;
}) {
  const pageSize = input.pageSize ?? ARCGIS_FEATURE_PAGE_SIZE;
  const maxBytes = input.maxBytes ?? MAX_ARCGIS_RESPONSE_BYTES;
  const features: Record<string, unknown>[] = [];
  let objectIdField: string | null = null;
  let offset = 0;
  let pageIndex = 0;
  let totalBytes = 0;
  let httpStatus: number | null = null;
  let orderingDiscovered = false;

  if (pageSize <= 0) {
    throw new ApiConnectionError("ArcGIS page size must be greater than zero.");
  }

  while (true) {
    const pageUrl = getArcgisFeaturePageUrl({
      url: input.url,
      pageSize,
      offset,
      objectIdField,
    });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let response: Response;

    try {
      response = await (input.fetchSafe ?? fetchWithSafeRedirects)({
        url: pageUrl,
        init: {
          method: "GET",
          headers: input.headers,
          signal: controller.signal,
        },
      });
    } finally {
      clearTimeout(timeout);
    }

    httpStatus = response.status;
    input.onHttpStatus?.(response.status);

    const remainingBytes = Math.max(0, maxBytes - totalBytes);
    const body = await readLimitedResponse(response, remainingBytes);
    totalBytes += Buffer.byteLength(body);

    if (totalBytes > maxBytes) {
      throw new ApiConnectionError("API response is too large.", 502);
    }

    if (!response.ok) {
      throw new ApiConnectionError(`API request failed with HTTP ${response.status}.`, 502);
    }

    const page = parseArcgisFeaturePage(body);

    if (!objectIdField) {
      const requestAlreadyOrdered = Boolean(
        new URL(pageUrl).searchParams.get("orderByFields")?.trim(),
      );
      objectIdField = page.objectIdField;

      if (
        !objectIdField &&
        (page.exceededTransferLimit || page.features.length >= pageSize)
      ) {
        throw new ApiConnectionError(
          "ArcGIS API did not identify an object ID field for stable pagination.",
          502,
        );
      }

      if (objectIdField && !requestAlreadyOrdered && !orderingDiscovered) {
        orderingDiscovered = true;
        await input.log?.(
          `Discovered ArcGIS object ID field ${objectIdField}; refetching page zero in stable order.`,
        );
        continue;
      }
    }

    features.push(...page.features);

    await input.log?.(
      `Fetched ArcGIS page ${pageIndex}: ${page.features.length} features (${features.length} total).`,
    );

    if (!page.exceededTransferLimit && page.features.length < pageSize) {
      break;
    }

    if (page.features.length === 0) {
      throw new ApiConnectionError(
        "ArcGIS API reported more rows but returned an empty page.",
        502,
      );
    }

    offset += page.features.length;
    pageIndex += 1;
  }

  return {
    body: JSON.stringify(features),
    featureCount: features.length,
    httpStatus,
  };
}

export function parseArcgisFeatureRows(features: unknown[]) {
  const rawRows = features.map((feature) => {
    if (!isRecord(feature)) {
      throw new ApiConnectionError("ArcGIS feature rows must be objects.", 502);
    }

    const row: Record<string, string> = {};
    const attributes = feature.attributes;

    if (isRecord(attributes)) {
      for (const [key, value] of Object.entries(attributes)) {
        row[key] = apiValueToString(value);
      }
    } else {
      for (const [key, value] of Object.entries(feature)) {
        if (key !== "geometry") {
          row[key] = apiValueToString(value);
        }
      }
    }

    if (isRecord(feature.geometry)) {
      for (const [key, value] of Object.entries(feature.geometry)) {
        row[`geometry_${key}`] = apiValueToString(value);
      }
    }

    return row;
  });
  const columns = rowsToColumns(rawRows);

  return {
    rows: alignRowsToColumns({ rows: rawRows, columns }),
    columns,
  };
}


export const arcgisProvider: ConnectionProvider = {
  name: "arcgis",
  matches: ({ connection, requestUrl }) =>
    isArcgisFeatureConnection({
      url: requestUrl,
      responseFormat: connection.responseFormat,
      responseDataPath: connection.responseDataPath,
    }),
  fetch: async ({ connection, requestConfig, log, onHttpStatus }) => {
    if (isImbApiConnection(connection)) {
      const adapter = getImbSourceAdapterMetadata();
      await log(
        `Using ${adapter.version} source adapter (${adapter.checksum.slice(0, 12)}).`,
      );
    }
    const result = await fetchArcgisFeaturePages({
      url: requestConfig.url,
      headers: requestConfig.headers,
      log,
      onHttpStatus,
    });

    return {
      body: result.body,
      httpStatus: result.httpStatus,
      parsed: null,
    };
  },
  parse: ({ body, connection }) => {
    const features = JSON.parse(body) as unknown[];
    return parseArcgisFeatureRows(
      isImbApiConnection(connection)
        ? adaptCurrentImbArcgisFeatures(features)
        : features,
    );
  },
};
