import type { Fetcher as CloudflareFetcher } from "@cloudflare/workers-types";

declare global {
  type Fetcher = CloudflareFetcher;
}

export {};
