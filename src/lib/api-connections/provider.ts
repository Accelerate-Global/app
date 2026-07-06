import type { apiConnections } from "@/db/schema";

import type { ParsedApiRows } from "./core";
import { arcgisProvider } from "./providers/arcgis";
import { etnopediaProvider } from "./providers/etnopedia";
import { genericHttpProvider } from "./providers/generic-http";
import { googleSheetsProvider } from "./providers/google-sheets";

export type ApiConnectionRecord = typeof apiConnections.$inferSelect;

export type ConnectionRunLogger = (message: string) => Promise<void>;

export type ConnectionRunRequestConfig = {
  url: string;
  headers: Headers;
  body?: string;
};

export type ConnectionProviderFetchInput = {
  connection: ApiConnectionRecord;
  requestConfig: ConnectionRunRequestConfig;
  secrets: Map<string, string>;
  log: ConnectionRunLogger;
  onHttpStatus: (status: number) => void;
};

export type ConnectionProviderFetchResult = {
  body: string;
  httpStatus: number | null;
  parsed: ParsedApiRows | null;
};

/**
 * The connection-provider seam. An adapter owns one upstream provider's
 * detection, fetch, and parse behavior; the run orchestrator in `index.ts`
 * owns everything else: run state, logs, artifacts, resources, publication.
 * Registry order is precedence; generic-http is the fallback and must stay
 * last.
 */
export type ConnectionProvider = {
  name: "google_sheets" | "etnopedia" | "arcgis" | "http_api";
  matches(input: {
    connection: ApiConnectionRecord;
    requestUrl: string;
  }): boolean;
  fetch(
    input: ConnectionProviderFetchInput,
  ): Promise<ConnectionProviderFetchResult>;
  parse(input: {
    body: string;
    connection: ApiConnectionRecord;
  }): ParsedApiRows;
};

const CONNECTION_PROVIDERS: readonly ConnectionProvider[] = [
  googleSheetsProvider,
  etnopediaProvider,
  arcgisProvider,
  genericHttpProvider,
];

export function resolveConnectionProvider(input: {
  connection: ApiConnectionRecord;
  requestUrl: string;
}): ConnectionProvider {
  return (
    CONNECTION_PROVIDERS.find((provider) => provider.matches(input)) ??
    genericHttpProvider
  );
}
