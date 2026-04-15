import path from "node:path";

export const UI_SMOKE_BASE_URL =
  process.env.UI_SMOKE_BASE_URL?.trim() || "http://127.0.0.1:3100";

export const UI_SMOKE_TMP_DIR = path.join(process.cwd(), ".tmp/ui-smoke");
export const UI_SMOKE_AUTH_DIR = path.join(UI_SMOKE_TMP_DIR, "auth");
export const UI_SMOKE_BOOTSTRAP_FILE = path.join(
  UI_SMOKE_TMP_DIR,
  "bootstrap.json",
);

export const UI_SMOKE_STORAGE_STATES = {
  anonymous: path.join(UI_SMOKE_AUTH_DIR, "anonymous.json"),
  viewer: path.join(UI_SMOKE_AUTH_DIR, "viewer.json"),
  admin: path.join(UI_SMOKE_AUTH_DIR, "admin.json"),
} as const;

export const UI_SMOKE_PASSWORD = "SmokePass123!";

export const UI_SMOKE_USERS = {
  viewer: {
    email: "smoke-viewer@accelerate-global.test",
    password: UI_SMOKE_PASSWORD,
    fullName: "Smoke Viewer",
  },
  admin: {
    email: "smoke-admin@accelerate-global.test",
    password: UI_SMOKE_PASSWORD,
    fullName: "Smoke Admin",
  },
} as const;

export type UiSmokeBootstrap = {
  generatedAt: string;
  baseUrl: string;
  aliases: {
    primaryDatasetId: string;
    secondaryDatasetId: string;
    editableFieldDefinitionId: string;
    editableFieldSourceTypeId: string;
    southAsiaRegionId: string;
    latinAmericaRegionId: string;
  };
  users: {
    viewer: {
      id: string;
      email: string;
      fullName: string;
    };
    admin: {
      id: string;
      email: string;
      fullName: string;
    };
  };
  datasets: {
    primary: {
      id: string;
      fileName: string;
    };
    secondary: {
      id: string;
      fileName: string;
    };
  };
  fieldDefinitions: {
    editable: {
      id: string;
      canonicalKey: string;
      label: string;
    };
  };
  fieldSourceTypes: {
    editable: {
      id: string;
      key: string;
      label: string;
    };
  };
  filterRegions: {
    southAsia: {
      id: string;
      name: string;
    };
    latinAmerica: {
      id: string;
      name: string;
    };
  };
};
