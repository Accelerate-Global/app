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
  pro: path.join(UI_SMOKE_AUTH_DIR, "pro.json"),
  basic: path.join(UI_SMOKE_AUTH_DIR, "basic.json"),
  admin: path.join(UI_SMOKE_AUTH_DIR, "admin.json"),
} as const;

export const UI_SMOKE_PASSWORD = "SmokePass123!";
export const UI_SMOKE_PASSWORD_RESET = "SmokePass456!";

export type UiSmokeBootstrapScope =
  | "full"
  | "auth"
  | "datasets"
  | "admin-config";

export const UI_SMOKE_USERS = {
  pro: {
    email: "smoke-pro@accelerate-global.test",
    password: UI_SMOKE_PASSWORD,
    fullName: "Smoke Pro",
  },
  basic: {
    email: "smoke-basic@accelerate-global.test",
    password: UI_SMOKE_PASSWORD,
    fullName: "Smoke Basic",
  },
  admin: {
    email: "smoke-admin@accelerate-global.test",
    password: UI_SMOKE_PASSWORD,
    fullName: "Smoke Admin",
  },
  recovery: {
    email: "smoke-recovery@accelerate-global.test",
    password: UI_SMOKE_PASSWORD,
    fullName: "Smoke Recovery",
  },
  forgotPassword: {
    email: "smoke-forgot-password@accelerate-global.test",
    password: UI_SMOKE_PASSWORD,
    fullName: "Smoke Forgot Password",
  },
  reset: {
    email: "smoke-reset@accelerate-global.test",
    password: UI_SMOKE_PASSWORD,
    fullName: "Smoke Reset",
  },
  signOut: {
    email: "smoke-sign-out@accelerate-global.test",
    password: UI_SMOKE_PASSWORD,
    fullName: "Smoke Sign Out",
  },
  disable: {
    email: "smoke-disable@accelerate-global.test",
    password: UI_SMOKE_PASSWORD,
    fullName: "Smoke Disable",
  },
  allowlistedSignup: {
    email: "smoke-sign-up@accelerate-global.test",
    password: UI_SMOKE_PASSWORD,
    fullName: "Smoke Sign Up",
  },
} as const;

export type UiSmokeBootstrap = {
  generatedAt: string;
  baseUrl: string;
  scope: UiSmokeBootstrapScope;
  aliases: {
    primaryDatasetId: string;
    secondaryDatasetId: string;
    derivedDatasetId: string;
    editableFieldDefinitionId: string;
    editableFieldSourceTypeId: string;
  };
  users: {
    pro: {
      id: string;
      email: string;
      fullName: string;
    };
    basic: {
      id: string;
      email: string;
      fullName: string;
    };
    admin: {
      id: string;
      email: string;
      fullName: string;
    };
    recovery: {
      id: string;
      email: string;
      fullName: string;
    };
    forgotPassword: {
      id: string;
      email: string;
      fullName: string;
    };
    reset: {
      id: string;
      email: string;
      fullName: string;
    };
    signOut: {
      id: string;
      email: string;
      fullName: string;
    };
    disable: {
      id: string;
      email: string;
      fullName: string;
    };
  };
  authFlows: {
    allowlistedSignup: {
      email: string;
      password: string;
      fullName: string;
    };
    passwordReset: {
      nextPassword: string;
    };
  };
  datasets: {
    primary: {
      id: string;
      fileName: string;
      classification: "PGAC" | "PGIC";
    };
    derived: {
      id: string;
      fileName: string;
      classification: "PGAC" | "PGIC";
    };
    secondary: {
      id: string;
      fileName: string;
      classification: "PGAC" | "PGIC";
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
};
