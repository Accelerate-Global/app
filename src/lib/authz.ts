export type OwnedRecord = {
  ownerId: string;
};

export function isDatasetOwner(
  record: OwnedRecord | null | undefined,
  ownerId: string,
) {
  return Boolean(record && record.ownerId === ownerId);
}

export function assertDatasetOwner(
  record: OwnedRecord | null | undefined,
  ownerId: string,
) {
  if (!isDatasetOwner(record, ownerId)) {
    throw new Error("Dataset not found.");
  }
}
