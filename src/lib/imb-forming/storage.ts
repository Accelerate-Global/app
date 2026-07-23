import {
  deleteDatasetFormingArtifacts,
  readDatasetFormingArtifact,
  uploadDatasetFormingArtifact,
} from "@/lib/dataset-forming/storage";
import { IMB_FORMING_ENGINE_KEY } from "@/lib/dataset-forming/engines/imb";

import type { ImbFormingArtifactKind } from "./types";

export async function uploadImbFormingArtifact(input: {
  sourceRunId: string;
  formingRunId: string;
  kind: ImbFormingArtifactKind;
  body: string;
}) {
  return uploadDatasetFormingArtifact(
    { ...input, engineKey: IMB_FORMING_ENGINE_KEY },
    "IMB forming",
  );
}

export async function readImbFormingArtifact(path: string) {
  return readDatasetFormingArtifact(path, "IMB forming");
}

export async function deleteImbFormingArtifacts(paths: string[]) {
  return deleteDatasetFormingArtifacts(paths, "IMB forming");
}
