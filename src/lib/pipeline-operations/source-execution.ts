import type { ApiConnection } from "@/lib/api-types";
import {
  getApiConnection,
  listCodeManagedApiConnections,
} from "@/lib/api-connections";
import { getImbSourceAdapterMetadata } from "@/lib/api-connections/providers/imb";
import { checksumDatasetFormingValue } from "@/lib/dataset-forming";

import type {
  PipelineFlowDefinition,
  PipelineJsonObject,
} from "./types";
import { fingerprintPipelineInputs } from "./validation";

type SourceExecutionConnection = Pick<
  ApiConnection,
  | "id"
  | "method"
  | "url"
  | "headers"
  | "bodyTemplate"
  | "responseFormat"
  | "responseDataPath"
  | "provider"
  | "providerConfig"
  | "archivedAt"
>;

export type PipelineSourceAdapterMetadata = Readonly<{
  key: string;
  version: string;
  checksum: string;
}>;

export type PipelineSourceExecutionBinding = Readonly<{
  sourceProfileKey: string;
  connectionId: string;
  configChecksum: string;
  adapterKey: string;
  adapterVersion: string;
  adapterChecksum: string;
  checksum: string;
}>;

function adapterContract(input: {
  key: string;
  version: string;
  behavior: readonly string[];
}): PipelineSourceAdapterMetadata {
  return Object.freeze({
    key: input.key,
    version: input.version,
    checksum: checksumDatasetFormingValue(input),
  });
}

const imbAdapter = getImbSourceAdapterMetadata();
const sourceAdapters = new Map<string, PipelineSourceAdapterMetadata>([
  ["imb-people-groups", {
    key: imbAdapter.name,
    version: imbAdapter.version,
    checksum: imbAdapter.checksum,
  }],
  ["etnopedia-people-groups", adapterContract({
    key: "etnopedia-mediawiki-export",
    version: "etnopedia-source-v1",
    behavior: ["mediawiki-pagination", "deterministic-record-export"],
  })],
  ["joshua-project-pgic", adapterContract({
    key: "joshua-project-http-export",
    version: "joshua-project-source-v1",
    behavior: ["secret-api-key-header", "json-record-export"],
  })],
  ["wcd-people-groups", adapterContract({
    key: "google-sheets-tab-export",
    version: "google-sheets-source-v1",
    behavior: ["spreadsheet-id", "sheet-id", "header-selection", "full-tab"],
  })],
  ["accelerate-owned-people-groups", adapterContract({
    key: "google-sheets-tab-export",
    version: "google-sheets-source-v1",
    behavior: ["spreadsheet-id", "sheet-id", "header-selection", "full-tab"],
  })],
  ["tier2-partner", adapterContract({
    key: "google-sheets-tab-export",
    version: "google-sheets-source-v1",
    behavior: ["spreadsheet-id", "sheet-id", "header-selection", "full-tab"],
  })],
]);

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function tier2CanaryContractFingerprint(exactInputs: PipelineJsonObject) {
  const profileId = exactInputs.profileId;
  if (typeof profileId !== "string" || !profileId) return null;
  const profiles = asRecord(exactInputs.tier2ProfileBindings);
  const profile = Object.values(profiles).map(asRecord).find(
    (candidate) => candidate.id === profileId,
  );
  if (
    !profile ||
    typeof profile.contractChecksum !== "string" ||
    !profile.contractChecksum
  ) {
    return null;
  }
  const contractBindings = asRecord(exactInputs.tier2ContractBindings);
  if (Object.keys(contractBindings).length === 0) return null;
  return fingerprintPipelineInputs({
    profileId,
    profileContractChecksum: profile.contractChecksum,
    contractBindings,
  });
}

export function getPipelineSourceAdapterMetadata(sourceProfileKey: string) {
  const metadata = sourceAdapters.get(sourceProfileKey);
  if (!metadata) {
    throw new Error(`No ingestion adapter contract is registered for ${sourceProfileKey}.`);
  }
  return metadata;
}

export function checksumPipelineSourceExecutionConfig(
  connection: SourceExecutionConnection,
) {
  const providerConfig = connection.providerConfig ?? { provider: "http_api" };
  const executionProviderConfig =
    providerConfig.provider === "google_sheets"
      ? {
          ...providerConfig,
          // Live titles are display metadata. Immutable spreadsheetId/sheetId
          // continue to define the selected tab when either title is renamed.
          spreadsheetTitle: undefined,
          sheetTitle: undefined,
        }
      : providerConfig;
  return checksumDatasetFormingValue({
    method: connection.method,
    url: connection.url,
    headers: connection.headers.map((header) => ({
      name: header.name,
      value: header.isSecret ? null : header.value,
      isSecret: header.isSecret,
    })),
    bodyTemplate: connection.bodyTemplate,
    responseFormat: connection.responseFormat,
    responseDataPath: connection.responseDataPath,
    provider: connection.provider ?? "http_api",
    providerConfig: executionProviderConfig,
  });
}

export function createPipelineSourceExecutionBinding(input: {
  sourceProfileKey: string;
  connection: SourceExecutionConnection;
}): PipelineSourceExecutionBinding {
  const adapter = getPipelineSourceAdapterMetadata(input.sourceProfileKey);
  const binding = {
    sourceProfileKey: input.sourceProfileKey,
    connectionId: input.connection.id,
    configChecksum: checksumPipelineSourceExecutionConfig(input.connection),
    adapterKey: adapter.key,
    adapterVersion: adapter.version,
    adapterChecksum: adapter.checksum,
  };
  return {
    ...binding,
    checksum: checksumDatasetFormingValue(binding),
  };
}

export async function resolveCurrentPipelineSourceExecutionBinding(input: {
  sourceProfileKey: string;
  connectionId: string;
}) {
  const codeManaged = listCodeManagedApiConnections().find(
    (connection) => connection.id === input.connectionId,
  );
  const connection = codeManaged ?? await getApiConnection(input.connectionId);
  if (!connection || connection.archivedAt) return null;
  return createPipelineSourceExecutionBinding({
    sourceProfileKey: input.sourceProfileKey,
    connection,
  });
}

export function getPinnedPipelineSourceExecutionBinding(input: {
  exactInputs: PipelineJsonObject;
  sourceProfileKey: string;
  connectionId: string;
}) {
  const bindings = asRecord(input.exactInputs.sourceExecutionBindings);
  const direct = asRecord(bindings[input.sourceProfileKey]);
  if (direct.connectionId === input.connectionId) return direct;
  const match = Object.values(bindings).map(asRecord).find(
    (binding) =>
      binding.sourceProfileKey === input.sourceProfileKey &&
      binding.connectionId === input.connectionId,
  );
  return match ?? {};
}

export function pipelineSourceCanaryMatchesCurrent(input: {
  definition: PipelineFlowDefinition;
  canaryExactInputs: PipelineJsonObject;
  currentExactInputs: PipelineJsonObject;
}) {
  if (input.definition.key === "tier2-partner") {
    const currentContractFingerprint = tier2CanaryContractFingerprint(
      input.currentExactInputs,
    );
    const canaryContractFingerprint = tier2CanaryContractFingerprint(
      input.canaryExactInputs,
    );
    if (
      !currentContractFingerprint ||
      currentContractFingerprint !== canaryContractFingerprint
    ) {
      return false;
    }
  }
  const profileKeys = [...new Set(
    input.definition.stages
      .filter((stage) => stage.kind === "ingestion" && stage.sourceProfileKey)
      .map((stage) => stage.sourceProfileKey!),
  )];
  return profileKeys.every((sourceProfileKey) => {
    const currentConnections = asRecord(input.currentExactInputs.connectionIds);
    const connectionId = sourceProfileKey === "tier2-partner"
      ? (() => {
          const profileId = input.currentExactInputs.profileId;
          const profiles = asRecord(input.currentExactInputs.tier2ProfileBindings);
          const profile = Object.values(profiles).map(asRecord).find(
            (candidate) => candidate.id === profileId,
          );
          return typeof profile?.connectionId === "string"
            ? profile.connectionId
            : null;
        })()
      : typeof currentConnections[sourceProfileKey] === "string"
        ? currentConnections[sourceProfileKey] as string
        : null;
    if (!connectionId) return false;
    const current = getPinnedPipelineSourceExecutionBinding({
      exactInputs: input.currentExactInputs,
      sourceProfileKey,
      connectionId,
    });
    const canary = getPinnedPipelineSourceExecutionBinding({
      exactInputs: input.canaryExactInputs,
      sourceProfileKey,
      connectionId,
    });
    return typeof current.checksum === "string" && current.checksum === canary.checksum;
  });
}
