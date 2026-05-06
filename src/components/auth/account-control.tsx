"use client";

import {
  BookTextIcon,
  CableIcon,
  ChevronDownIcon,
  DatabaseIcon,
  FileTextIcon,
  LayoutDashboardIcon,
  ActivityIcon,
  LogOutIcon,
  MonitorIcon,
  UploadIcon,
  UserIcon,
  UsersIcon,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import {
  applyDocumentThemePreference,
  getDocumentThemeState,
  subscribeToSystemThemeChanges,
  type ThemePreference,
  type ThemeState,
} from "@/components/theme/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Toggle } from "@/components/ui/toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { CurrentIdentity } from "@/lib/auth";
import { getIdentityDisplayName, getIdentityInitials } from "@/lib/account-display";
import {
  buildAnalyticsContext,
  getAnalyticsRouteFromPathname,
  getAnalyticsWorkspaceRole,
  withAnalyticsContext,
} from "@/lib/analytics";
import { trackAppEvent } from "@/lib/analytics-client";

type AccountControlProps = {
  identity: CurrentIdentity;
};

type ThemeOption = {
  preference: ThemePreference;
  label: string;
};

const DEFAULT_THEME_STATE: ThemeState = {
  preference: "system",
  resolvedTheme: "light",
};

const themeOptions: ThemeOption[] = [
  {
    preference: "system",
    label: "System",
  },
  {
    preference: "light",
    label: "Light",
  },
  {
    preference: "dark",
    label: "Dark",
  },
];

function subscribeToHydration(callback: () => void) {
  queueMicrotask(callback);
  return () => undefined;
}

export function AccountControl({ identity }: AccountControlProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const isTriggerReady = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );
  const [themeState, setThemeState] = useState<ThemeState>(() =>
    typeof document === "undefined"
      ? DEFAULT_THEME_STATE
      : getDocumentThemeState(),
  );
  const displayName = useMemo(() => getIdentityDisplayName(identity), [identity]);
  const initials = useMemo(
    () => getIdentityInitials(identity),
    [identity],
  );
  const analyticsContext = useMemo(
    () =>
      buildAnalyticsContext({
        route: getAnalyticsRouteFromPathname(pathname),
        actorOwnerId: identity.ownerId,
        workspaceRole: getAnalyticsWorkspaceRole(identity.workspaceRole),
      }),
    [identity.ownerId, identity.workspaceRole, pathname],
  );

  useEffect(() => {
    applyDocumentThemePreference(getDocumentThemeState().preference);
    return subscribeToSystemThemeChanges(setThemeState);
  }, []);

  async function signOut() {
    setIsSigningOut(true);
    let success = false;

    try {
      const response = await fetch("/auth/sign-out", { method: "POST" });
      success = response.ok;
    } catch {
      success = false;
    }

    trackAppEvent(
      "sign_out",
      withAnalyticsContext(analyticsContext, {
        source_surface: "account_menu",
        success,
        error_code: success ? undefined : "sign_out_failed",
      }),
    );

    if (typeof window !== "undefined") {
      window.location.assign("/");
      return;
    }

    router.push("/");
    router.refresh();
  }

  function selectThemePreference(preference: ThemePreference) {
    const previousThemeState = themeState;
    const nextThemeState = applyDocumentThemePreference(preference);

    trackAppEvent(
      "theme_toggled",
      withAnalyticsContext(analyticsContext, {
        source_surface: "account_menu",
        success: true,
        from_preference: previousThemeState.preference,
        to_preference: nextThemeState.preference,
        from_theme: previousThemeState.resolvedTheme,
        to_theme: nextThemeState.resolvedTheme,
      }),
    );
    setThemeState(nextThemeState);
  }

  function navigateTo(href: string) {
    router.push(href);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            data-smoke-trigger="account-menu"
            data-smoke-close="account-menu"
            data-smoke-await-ready="true"
            data-smoke-trigger-ready={isTriggerReady ? "account-menu" : undefined}
            className="inline-flex h-14 w-fit max-w-full items-center gap-3 rounded-[1.25rem] border border-border bg-background px-4 text-left shadow-none transition-colors hover:bg-accent/35"
          />
        }
      >
        <Avatar size="sm" className="size-7">
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <span className="truncate text-base font-semibold text-foreground">
          {displayName}
        </span>
        <ChevronDownIcon className="size-4 text-foreground/60" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={10}
        className="w-72 rounded-2xl p-2"
        data-smoke-surface="account-menu"
        data-smoke-ready="account-menu"
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-2 py-2 text-foreground">
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  {displayName}
                </p>
                <p className="truncate text-xs font-normal text-muted-foreground">
                  {identity.email ?? "Supabase user"}
                </p>
              </div>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigateTo("/dashboard/profile")}>
            <UserIcon aria-hidden="true" />
            Profile
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigateTo("/dashboard")}>
            <LayoutDashboardIcon aria-hidden="true" />
            Dashboard
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigateTo("/dashboard/field-definitions")}>
            <BookTextIcon aria-hidden="true" />
            Definitions
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigateTo("/dashboard/resources")}>
            <FileTextIcon aria-hidden="true" />
            Resources
          </DropdownMenuItem>
          <div className="px-2 py-2" data-slot="appearance-control">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
              <MonitorIcon className="size-4" aria-hidden="true" />
              <span>Appearance</span>
            </div>
            <div
              role="group"
              aria-label="Appearance"
              className="grid grid-cols-3 gap-2"
            >
              {themeOptions.map((option) => (
                <Toggle
                  key={option.preference}
                  size="sm"
                  pressed={themeState.preference === option.preference}
                  onPressedChange={(pressed) => {
                    if (pressed) {
                      selectThemePreference(option.preference);
                    }
                  }}
                  className="h-9 rounded-lg bg-transparent px-3 text-sm font-semibold hover:bg-muted data-[state=on]:bg-muted data-[state=on]:shadow-none"
                >
                  {option.label}
                </Toggle>
              ))}
            </div>
          </div>
          {identity.isDatasetAdmin ? <DropdownMenuSeparator /> : null}
          {identity.isDatasetAdmin ? (
            <>
              <DropdownMenuItem onClick={() => navigateTo("/dashboard/field-sources")}>
                <DatabaseIcon aria-hidden="true" />
                Manage Field Sources
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigateTo("/dashboard/api-connections")}>
                <CableIcon aria-hidden="true" />
                Datasets
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigateTo("/dashboard/analytics")}>
                <ActivityIcon aria-hidden="true" />
                Analytics
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigateTo("/dashboard/user-management")}>
                <UsersIcon aria-hidden="true" />
                User Management
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigateTo("/dashboard/upload")}>
                <UploadIcon aria-hidden="true" />
                Upload
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          disabled={isSigningOut}
          onClick={signOut}
        >
          <LogOutIcon aria-hidden="true" />
          {isSigningOut ? "Signing out..." : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
