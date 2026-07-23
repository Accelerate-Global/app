import { ACCELERATE_SOURCE_CONTRACT } from "./contracts";
import { formSourceRows } from "./engine";
import type { FormSourceRowsInput } from "./types";

export function formAccelerateRows(input: FormSourceRowsInput) {
  return formSourceRows(ACCELERATE_SOURCE_CONTRACT, input);
}
