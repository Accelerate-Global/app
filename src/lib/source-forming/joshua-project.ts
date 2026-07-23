import { JOSHUA_PROJECT_SOURCE_CONTRACT } from "./contracts";
import { formSourceRows } from "./engine";
import type { FormSourceRowsInput } from "./types";

export function formJoshuaProjectRows(input: FormSourceRowsInput) {
  return formSourceRows(JOSHUA_PROJECT_SOURCE_CONTRACT, input);
}
