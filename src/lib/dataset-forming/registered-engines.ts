import { TIER1_SOURCE_FORMING_ENGINES } from "@/lib/source-forming";

import { IMB_FORMING_ENGINE } from "./engines/imb";
import { createDatasetFormingEngineRegistry } from "./registry";

export const datasetFormingEngineRegistry =
  createDatasetFormingEngineRegistry([
    IMB_FORMING_ENGINE,
    ...TIER1_SOURCE_FORMING_ENGINES,
  ]);
