import type {
  SavedDatasetFilterState,
  SavedDatasetSort,
} from "@/lib/api-types";
import type { WorkspaceRole } from "@/lib/workspace-role";

export type AnalyticsWorkspaceRole = WorkspaceRole | "anonymous";

export type AppAnalyticsRoute =
  | "sign_in"
  | "sign_up"
  | "forgot_password"
  | "reset_password"
  | "dashboard"
  | "dataset_detail"
  | "dataset_edit"
  | "upload"
  | "user_management"
  | "profile"
  | "field_definitions"
  | "field_sources"
  | "filter_settings";

export type DatasetOpenSource =
  | "dashboard"
  | "saved_table"
  | "default_redirect";

export type DatasetUploadFailureStage =
  | "validation"
  | "header_parse"
  | "authorize"
  | "blob_upload"
  | "dataset_create"
  | "dataset_replace"
  | "row_persist"
  | "mark_failed";

export type AppAnalyticsContext = {
  route: AppAnalyticsRoute;
  actor_owner_id: string;
  workspace_role: AnalyticsWorkspaceRole;
};

export type AppAnalyticsEventBase = AppAnalyticsContext & {
  source_surface: string;
  success: boolean;
  error_code?: string;
  duration_ms?: number;
  dataset_id?: string;
  saved_table_id?: string;
  target_user_id?: string;
};

export type AppAnalyticsEventMap = {
  auth_sign_in_succeeded: AppAnalyticsEventBase;
  auth_sign_in_failed: AppAnalyticsEventBase;
  auth_sign_up_started: AppAnalyticsEventBase;
  auth_sign_up_allowlist_rejected: AppAnalyticsEventBase;
  auth_sign_up_confirmation_required: AppAnalyticsEventBase;
  auth_sign_up_succeeded: AppAnalyticsEventBase;
  password_reset_requested: AppAnalyticsEventBase;
  password_reset_completed: AppAnalyticsEventBase;
  password_reset_invalid_link: AppAnalyticsEventBase;
  sign_out: AppAnalyticsEventBase;
  dashboard_viewed: AppAnalyticsEventBase & {
    dataset_count: number;
    saved_table_count: number;
  };
  dataset_opened: AppAnalyticsEventBase & {
    dataset_id: string;
    dataset_source: DatasetOpenSource;
  };
  dataset_rows_loaded: AppAnalyticsEventBase & {
    dataset_id: string;
    dataset_source: DatasetOpenSource;
    row_count: number;
    load_duration_ms: number;
  };
  dataset_rows_failed: AppAnalyticsEventBase & {
    dataset_id: string;
    dataset_source: DatasetOpenSource;
  };
  dataset_filters_applied: AppAnalyticsEventBase & {
    dataset_id: string;
    result_count: number;
    region_enabled: boolean;
    region_count: number;
    country_enabled: boolean;
    country_count: number;
    watchlist_enabled: boolean;
    watchlist_threshold_enabled: boolean;
    watchlist_threshold: number | null;
    watchlist_frontier_group_enabled: boolean;
    watchlist_frontier_group_value: boolean | null;
    watchlist_engagement_phase_enabled: boolean;
    watchlist_engagement_phase_threshold: number | null;
    uupg_enabled: boolean;
    sorting_count: number;
    sorting_keys: string | null;
  };
  dataset_downloaded: AppAnalyticsEventBase & {
    dataset_id: string;
    filtered_row_count: number;
    visible_column_count: number;
  };
  saved_table_opened: AppAnalyticsEventBase & {
    dataset_id: string;
    saved_table_id: string;
    saved_row_count: number;
    filter_sections_enabled: string;
  };
  saved_table_created: AppAnalyticsEventBase & {
    dataset_id: string;
    saved_table_id?: string;
    saved_row_count: number;
    filter_sections_enabled: string;
  };
  saved_table_updated: AppAnalyticsEventBase & {
    dataset_id: string;
    saved_table_id: string;
    saved_row_count: number;
    filter_sections_enabled: string;
  };
  saved_table_deleted: AppAnalyticsEventBase & {
    dataset_id: string;
    saved_table_id: string;
    saved_row_count: number;
    filter_sections_enabled: string;
  };
  dataset_open_preset_saved: AppAnalyticsEventBase & {
    dataset_id: string;
    tag_id: string;
    filter_sections_enabled: string;
  };
  dataset_open_preset_cleared: AppAnalyticsEventBase & {
    dataset_id: string;
    tag_id?: string;
  };
  dataset_open_preset_used: AppAnalyticsEventBase & {
    dataset_id: string;
    tag_id: string;
  };
  dataset_reordered: AppAnalyticsEventBase & {
    dataset_count: number;
  };
  dataset_upload_started: AppAnalyticsEventBase & {
    file_size_bytes: number;
    replace_target_dataset_id?: string;
  };
  dataset_upload_completed: AppAnalyticsEventBase & {
    dataset_id: string;
    file_size_bytes: number;
    column_count: number;
    row_count: number;
  };
  dataset_upload_failed: AppAnalyticsEventBase & {
    dataset_id?: string;
    file_size_bytes: number;
    column_count?: number;
    row_count?: number;
    replace_target_dataset_id?: string;
    failure_stage: DatasetUploadFailureStage;
  };
  dataset_replaced: AppAnalyticsEventBase & {
    dataset_id: string;
    replace_target_dataset_id: string;
    file_size_bytes: number;
    column_count: number;
    row_count: number;
  };
  dataset_metadata_saved: AppAnalyticsEventBase & {
    dataset_id: string;
    renamed: boolean;
    primary_changed: boolean;
    hidden_column_count: number;
    tag_count: number;
  };
  dataset_version_reverted: AppAnalyticsEventBase & {
    dataset_id: string;
    version_id: string;
  };
  dataset_deleted: AppAnalyticsEventBase & {
    dataset_id: string;
  };
  field_definition_search_used: AppAnalyticsEventBase & {
    query_length: number;
    result_count: number;
  };
  field_definition_info_opened: AppAnalyticsEventBase & {
    definition_id: string;
    linked_source_count: number;
    hidden_from_viewers: boolean;
  };
  field_definition_updated: AppAnalyticsEventBase & {
    definition_id: string;
    linked_source_count: number;
    hidden_from_viewers_changed: boolean;
  };
  field_source_value_saved: AppAnalyticsEventBase & {
    field_definition_id: string;
    source_type_id: string;
    has_value: boolean;
  };
  field_source_type_created: AppAnalyticsEventBase & {
    source_type_id?: string;
    label_length: number;
  };
  filter_region_created: AppAnalyticsEventBase & {
    region_id?: string;
    country_count: number;
    sort_order: number;
  };
  filter_region_updated: AppAnalyticsEventBase & {
    region_id: string;
    country_count: number;
    sort_order: number;
  };
  filter_region_deleted: AppAnalyticsEventBase & {
    region_id: string;
    country_count: number;
    sort_order: number;
  };
  profile_name_updated: AppAnalyticsEventBase;
  email_change_started: AppAnalyticsEventBase;
  account_disabled_self: AppAnalyticsEventBase;
  theme_toggled: AppAnalyticsEventBase & {
    from_theme: "light" | "dark";
    to_theme: "light" | "dark";
  };
  user_record_opened: AppAnalyticsEventBase & {
    target_user_id: string;
    target_status: string;
    target_role: WorkspaceRole;
  };
  user_invite_sent: AppAnalyticsEventBase & {
    target_user_id: string;
    to_role: WorkspaceRole;
  };
  user_invite_failed: AppAnalyticsEventBase & {
    to_role: WorkspaceRole;
  };
  user_role_changed: AppAnalyticsEventBase & {
    target_user_id: string;
    from_role: WorkspaceRole;
    to_role: WorkspaceRole;
    from_status: string;
    to_status: string;
  };
  user_disabled: AppAnalyticsEventBase & {
    target_user_id: string;
    from_role: WorkspaceRole;
    to_role: WorkspaceRole;
    from_status: string;
    to_status: string;
  };
  user_enabled: AppAnalyticsEventBase & {
    target_user_id: string;
    from_role: WorkspaceRole;
    to_role: WorkspaceRole;
    from_status: string;
    to_status: string;
  };
  admin_password_reset_sent: AppAnalyticsEventBase & {
    target_user_id: string;
    to_status: string;
  };
};

export type AppAnalyticsEventName = keyof AppAnalyticsEventMap;

type AppAnalyticsValue = string | number | boolean | null | undefined;

export function getAnalyticsWorkspaceRole(isDatasetAdmin: boolean) {
  return (isDatasetAdmin ? "admin" : "viewer") satisfies AnalyticsWorkspaceRole;
}

export function getAnalyticsRouteFromPathname(
  pathname: string | null | undefined,
): AppAnalyticsRoute {
  if (!pathname || pathname === "/dashboard") {
    return "dashboard";
  }

  if (pathname === "/") {
    return "sign_in";
  }

  if (pathname === "/sign-up") {
    return "sign_up";
  }

  if (pathname === "/forgot-password") {
    return "forgot_password";
  }

  if (pathname === "/reset-password") {
    return "reset_password";
  }

  if (pathname === "/dashboard/profile") {
    return "profile";
  }

  if (pathname === "/dashboard/upload") {
    return "upload";
  }

  if (pathname === "/dashboard/user-management") {
    return "user_management";
  }

  if (pathname === "/dashboard/field-definitions") {
    return "field_definitions";
  }

  if (pathname === "/dashboard/field-sources") {
    return "field_sources";
  }

  if (pathname === "/dashboard/filter-settings") {
    return "filter_settings";
  }

  if (pathname.startsWith("/dashboard/datasets/") && pathname.endsWith("/edit")) {
    return "dataset_edit";
  }

  if (pathname.startsWith("/dashboard/datasets")) {
    return "dataset_detail";
  }

  return "dashboard";
}

export function buildAnalyticsContext(input: {
  route: AppAnalyticsRoute;
  actorOwnerId: string;
  workspaceRole: AnalyticsWorkspaceRole;
}): AppAnalyticsContext {
  return {
    route: input.route,
    actor_owner_id: input.actorOwnerId,
    workspace_role: input.workspaceRole,
  };
}

export function withAnalyticsContext<
  T extends Omit<AppAnalyticsEventBase, keyof AppAnalyticsContext>,
>(context: AppAnalyticsContext, payload: T) {
  return {
    ...context,
    ...payload,
  };
}

export function sanitizeAnalyticsPayload(
  payload: Record<string, AppAnalyticsValue>,
) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined),
  );
}

export function getEnabledFilterSections(
  filters: SavedDatasetFilterState,
) {
  const sections: string[] = [];

  if (filters.region.enabled) {
    sections.push("region");
  }

  if (filters.country.enabled) {
    sections.push("country");
  }

  if (filters.watchlist.enabled) {
    sections.push("watchlist");
  }

  if (filters.uupg.enabled) {
    sections.push("uupg");
  }

  return sections.length > 0 ? sections.join("|") : "none";
}

export function getSortingKeys(
  sorting: SavedDatasetSort[],
) {
  if (sorting.length === 0) {
    return null;
  }

  return sorting
    .map((sort) => `${sort.id}:${sort.desc ? "desc" : "asc"}`)
    .join("|");
}

const UUID_SEGMENT_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function redactAnalyticsUrl(url: string) {
  const parsedUrl = new URL(url);

  parsedUrl.search = "";
  parsedUrl.hash = "";
  parsedUrl.pathname = parsedUrl.pathname
    .split("/")
    .map((segment) =>
      UUID_SEGMENT_PATTERN.test(segment) ? "[id]" : segment,
    )
    .join("/");

  return parsedUrl.toString();
}
