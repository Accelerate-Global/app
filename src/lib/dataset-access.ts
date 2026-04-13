const DEFAULT_DATASET_ADMIN_EMAIL = "admin@example.com";

export function getDatasetAdminEmail() {
  return (
    process.env.DATASET_ADMIN_EMAIL?.trim().toLowerCase() ??
    DEFAULT_DATASET_ADMIN_EMAIL
  );
}

export function isDatasetAdminEmail(email: string | null | undefined) {
  return Boolean(email && email.trim().toLowerCase() === getDatasetAdminEmail());
}
