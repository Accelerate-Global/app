import { ETNOPEDIA_SOURCE_CONTRACT } from "./contracts";
import { formSourceRows } from "./engine";
import type { FormSourceRowsInput } from "./types";

export function formEtnopediaRows(input: FormSourceRowsInput) {
  return formSourceRows(ETNOPEDIA_SOURCE_CONTRACT, input);
}
