import type {
  DatasetHotspotsMetric,
  SavedDatasetFilterState,
  SavedDatasetSort,
} from "@/lib/api-types";
import type { WorkspaceRole } from "@/lib/workspace-role";

export type AnalyticsWorkspaceRole = WorkspaceRole | "anonymous";

export const APP_ANALYTICS_ROUTES = [
  "sign_in",
  "sign_up",
  "forgot_password",
  "reset_password",
  "dashboard",
  "dataset_detail",
  "dataset_edit",
  "upload",
  "user_management",
  "profile",
  "field_definitions",
  "field_sources",
  "analytics",
] as const;

export type AppAnalyticsRoute =
  (typeof APP_ANALYTICS_ROUTES)[number];

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
  dataset_preload_started: AppAnalyticsEventBase & {
    dataset_id: string;
    source_dataset_id: string;
  };
  dataset_preload_completed: AppAnalyticsEventBase & {
    dataset_id: string;
    source_dataset_id: string;
    row_count: number;
    load_duration_ms: number;
  };
  dataset_preload_failed: AppAnalyticsEventBase & {
    dataset_id: string;
    source_dataset_id: string;
  };
  dataset_row_cache_hit: AppAnalyticsEventBase & {
    dataset_id: string;
    dataset_source: DatasetOpenSource;
    source_dataset_id: string;
    cached_row_count: number;
  };
  dataset_row_cache_miss: AppAnalyticsEventBase & {
    dataset_id: string;
    dataset_source: DatasetOpenSource;
    source_dataset_id: string;
    cached_row_count: number;
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
    watchlist_population_believers_rule_enabled: boolean;
    watchlist_population_believers_rule_tier_count: number | null;
    watchlist_engagement_phase_enabled: boolean;
    watchlist_engagement_phase_threshold: number | null;
    uupg_enabled: boolean;
    hotspots_enabled: boolean;
    hotspots_metric: DatasetHotspotsMetric | null;
    hotspots_country_count: number | null;
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
  dataset_assigned: AppAnalyticsEventBase & {
    dataset_id: string;
    source_dataset_id: string;
    target_dataset_id: string;
    assigned_row_count?: number;
    filter_sections_enabled: string;
    sorting_count: number;
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
type AnalyticsPayloadRecord = Record<string, unknown>;

export const APP_ANALYTICS_EVENT_NAMES = [
  "auth_sign_in_succeeded",
  "auth_sign_in_failed",
  "auth_sign_up_started",
  "auth_sign_up_allowlist_rejected",
  "auth_sign_up_confirmation_required",
  "auth_sign_up_succeeded",
  "password_reset_requested",
  "password_reset_completed",
  "password_reset_invalid_link",
  "sign_out",
  "dashboard_viewed",
  "dataset_opened",
  "dataset_rows_loaded",
  "dataset_preload_started",
  "dataset_preload_completed",
  "dataset_preload_failed",
  "dataset_row_cache_hit",
  "dataset_row_cache_miss",
  "dataset_rows_failed",
  "dataset_filters_applied",
  "dataset_downloaded",
  "saved_table_opened",
  "saved_table_created",
  "saved_table_updated",
  "saved_table_deleted",
  "dataset_open_preset_saved",
  "dataset_open_preset_cleared",
  "dataset_open_preset_used",
  "dataset_reordered",
  "dataset_upload_started",
  "dataset_upload_completed",
  "dataset_upload_failed",
  "dataset_replaced",
  "dataset_metadata_saved",
  "dataset_assigned",
  "dataset_version_reverted",
  "dataset_deleted",
  "field_definition_search_used",
  "field_definition_info_opened",
  "field_definition_updated",
  "field_source_value_saved",
  "field_source_type_created",
  "profile_name_updated",
  "email_change_started",
  "account_disabled_self",
  "theme_toggled",
  "user_record_opened",
  "user_invite_sent",
  "user_invite_failed",
  "user_role_changed",
  "user_disabled",
  "user_enabled",
  "admin_password_reset_sent",
] as const satisfies readonly AppAnalyticsEventName[];

export const APP_ANALYTICS_BASE_FIELDS = [
  "route",
  "actor_owner_id",
  "workspace_role",
  "source_surface",
  "success",
  "error_code",
  "duration_ms",
  "dataset_id",
  "saved_table_id",
  "target_user_id",
] as const satisfies readonly (keyof AppAnalyticsEventBase)[];

const APP_ANALYTICS_EVENT_PROPERTY_KEYS = {
  auth_sign_in_succeeded: [],
  auth_sign_in_failed: [],
  auth_sign_up_started: [],
  auth_sign_up_allowlist_rejected: [],
  auth_sign_up_confirmation_required: [],
  auth_sign_up_succeeded: [],
  password_reset_requested: [],
  password_reset_completed: [],
  password_reset_invalid_link: [],
  sign_out: [],
  dashboard_viewed: ["dataset_count", "saved_table_count"],
  dataset_opened: ["dataset_source"],
  dataset_rows_loaded: ["dataset_source", "row_count", "load_duration_ms"],
  dataset_preload_started: ["source_dataset_id"],
  dataset_preload_completed: [
    "source_dataset_id",
    "row_count",
    "load_duration_ms",
  ],
  dataset_preload_failed: ["source_dataset_id"],
  dataset_row_cache_hit: [
    "dataset_source",
    "source_dataset_id",
    "cached_row_count",
  ],
  dataset_row_cache_miss: [
    "dataset_source",
    "source_dataset_id",
    "cached_row_count",
  ],
  dataset_rows_failed: ["dataset_source"],
  dataset_filters_applied: [
    "result_count",
    "region_enabled",
    "region_count",
    "country_enabled",
    "country_count",
    "watchlist_enabled",
    "watchlist_threshold_enabled",
    "watchlist_threshold",
    "watchlist_population_believers_rule_enabled",
    "watchlist_population_believers_rule_tier_count",
    "watchlist_engagement_phase_enabled",
    "watchlist_engagement_phase_threshold",
    "uupg_enabled",
    "hotspots_enabled",
    "hotspots_metric",
    "hotspots_country_count",
    "sorting_count",
    "sorting_keys",
  ],
  dataset_downloaded: ["filtered_row_count", "visible_column_count"],
  saved_table_opened: ["saved_row_count", "filter_sections_enabled"],
  saved_table_created: ["saved_row_count", "filter_sections_enabled"],
  saved_table_updated: ["saved_row_count", "filter_sections_enabled"],
  saved_table_deleted: ["saved_row_count", "filter_sections_enabled"],
  dataset_open_preset_saved: ["tag_id", "filter_sections_enabled"],
  dataset_open_preset_cleared: ["tag_id"],
  dataset_open_preset_used: ["tag_id"],
  dataset_reordered: ["dataset_count"],
  dataset_upload_started: ["file_size_bytes", "replace_target_dataset_id"],
  dataset_upload_completed: ["file_size_bytes", "column_count", "row_count"],
  dataset_upload_failed: [
    "file_size_bytes",
    "column_count",
    "row_count",
    "replace_target_dataset_id",
    "failure_stage",
  ],
  dataset_replaced: [
    "replace_target_dataset_id",
    "file_size_bytes",
    "column_count",
    "row_count",
  ],
  dataset_metadata_saved: [
    "renamed",
    "primary_changed",
    "hidden_column_count",
    "tag_count",
  ],
  dataset_assigned: [
    "source_dataset_id",
    "target_dataset_id",
    "assigned_row_count",
    "filter_sections_enabled",
    "sorting_count",
  ],
  dataset_version_reverted: ["version_id"],
  dataset_deleted: [],
  field_definition_search_used: ["query_length", "result_count"],
  field_definition_info_opened: [
    "definition_id",
    "linked_source_count",
    "hidden_from_viewers",
  ],
  field_definition_updated: [
    "definition_id",
    "linked_source_count",
    "hidden_from_viewers_changed",
  ],
  field_source_value_saved: [
    "field_definition_id",
    "source_type_id",
    "has_value",
  ],
  field_source_type_created: ["source_type_id", "label_length"],
  profile_name_updated: [],
  email_change_started: [],
  account_disabled_self: [],
  theme_toggled: ["from_theme", "to_theme"],
  user_record_opened: ["target_status", "target_role"],
  user_invite_sent: ["to_role"],
  user_invite_failed: ["to_role"],
  user_role_changed: ["from_role", "to_role", "from_status", "to_status"],
  user_disabled: ["from_role", "to_role", "from_status", "to_status"],
  user_enabled: ["from_role", "to_role", "from_status", "to_status"],
  admin_password_reset_sent: ["to_status"],
} as const satisfies {
  [Name in AppAnalyticsEventName]: readonly string[];
};

const SUSPICIOUS_ANALYTICS_KEY_PATTERNS = [
  /^email$/iu,
  /^emails$/iu,
  /^password$/iu,
  /^passwords$/iu,
  /^token$/iu,
  /^tokens$/iu,
  /^query$/iu,
  /^queries$/iu,
  /^note$/iu,
  /^notes$/iu,
  /^csv$/iu,
  /^content$/iu,
  /^freeform$/iu,
  /(^|_)email($|_)/iu,
  /(^|_)password($|_)/iu,
  /(^|_)token($|_)/iu,
  /(^|_)query($|_)/iu,
  /(^|_)note($|_)/iu,
];

function normalizeAnalyticsValue(value: unknown): AppAnalyticsValue {
  if (value === null) {
    return null;
  }

  if (typeof value === "string") {
    return value.slice(0, 500);
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === "boolean") {
    return value;
  }

  return undefined;
}

function isSuspiciousAnalyticsKey(key: string) {
  return SUSPICIOUS_ANALYTICS_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

export function isAppAnalyticsRoute(value: string): value is AppAnalyticsRoute {
  return APP_ANALYTICS_ROUTES.includes(value as AppAnalyticsRoute);
}

export function isAppAnalyticsEventName(
  value: string,
): value is AppAnalyticsEventName {
  return APP_ANALYTICS_EVENT_NAMES.includes(value as AppAnalyticsEventName);
}

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

  if (pathname === "/dashboard/analytics") {
    return "analytics";
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
  payload: AnalyticsPayloadRecord,
) {
  return Object.fromEntries(
    Object.entries(payload).flatMap(([key, value]) => {
      const normalizedValue = normalizeAnalyticsValue(value);

      return normalizedValue === undefined ? [] : [[key, normalizedValue]];
    }),
  );
}

export function getAnalyticsEventBasePayload(payload: AnalyticsPayloadRecord) {
  const sanitizedPayload = sanitizeAnalyticsPayload(payload);

  return Object.fromEntries(
    APP_ANALYTICS_BASE_FIELDS.flatMap((key) =>
      key in sanitizedPayload ? [[key, sanitizedPayload[key]]] : [],
    ),
  ) satisfies Partial<Record<(typeof APP_ANALYTICS_BASE_FIELDS)[number], AppAnalyticsValue>>;
}

export function getAnalyticsEventPropertyKeys(name: AppAnalyticsEventName) {
  return APP_ANALYTICS_EVENT_PROPERTY_KEYS[name];
}

export function getAnalyticsEventProps(
  name: AppAnalyticsEventName,
  payload: AnalyticsPayloadRecord,
) {
  const sanitizedPayload = sanitizeAnalyticsPayload(payload);
  const allowedKeys = new Set<string>(getAnalyticsEventPropertyKeys(name));

  return Object.fromEntries(
    Object.entries(sanitizedPayload).filter(([key]) => {
      if ((APP_ANALYTICS_BASE_FIELDS as readonly string[]).includes(key)) {
        return false;
      }

      if (!allowedKeys.has(key)) {
        return false;
      }

      return !isSuspiciousAnalyticsKey(key);
    }),
  ) satisfies Record<string, Exclude<AppAnalyticsValue, undefined>>;
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

  if (filters.hotspots?.enabled) {
    sections.push("hotspots");
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
