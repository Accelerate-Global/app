import { WCD_SOURCE_CONTRACT } from "./contracts";
import { formSourceRows } from "./engine";
import type { FormSourceRowsInput } from "./types";

export function formWcdRows(input: FormSourceRowsInput) {
  return formSourceRows(WCD_SOURCE_CONTRACT, input);
}
