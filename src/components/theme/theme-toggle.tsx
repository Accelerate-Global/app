"use client";

import { useEffect, useState } from "react";
import { MoonIcon, SunIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

export const THEME_PREFERENCE_STORAGE_KEY = "ag-theme-preference";
export const LEGACY_THEME_STORAGE_KEY = "ag-theme";
export const SYSTEM_THEME_QUERY = "(prefers-color-scheme: dark)";

export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export type ThemeState = {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
};

const DEFAULT_THEME_STATE: ThemeState = {
  preference: "system",
  resolvedTheme: "light",
};

function isThemePreference(value: string | null): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

function getStoredThemePreference(): ThemePreference {
  if (typeof window === "undefined") {
    return "system";
  }

  window.localStorage.removeItem(LEGACY_THEME_STORAGE_KEY);

  const storedPreference = window.localStorage.getItem(
    THEME_PREFERENCE_STORAGE_KEY,
  );

  if (isThemePreference(storedPreference)) {
    return storedPreference;
  }

  window.localStorage.setItem(THEME_PREFERENCE_STORAGE_KEY, "system");
  return "system";
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined" || !window.matchMedia) {
    return "light";
  }

  return window.matchMedia(SYSTEM_THEME_QUERY).matches ? "dark" : "light";
}

export function resolveThemePreference(
  preference: ThemePreference,
): ResolvedTheme {
  return preference === "system" ? getSystemTheme() : preference;
}

function applyResolvedDocumentTheme(theme: ResolvedTheme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
}

export function getDocumentThemeState(): ThemeState {
  if (typeof document === "undefined") {
    return DEFAULT_THEME_STATE;
  }

  const preference = getStoredThemePreference();
  return {
    preference,
    resolvedTheme: resolveThemePreference(preference),
  };
}

export function applyDocumentThemePreference(
  preference: ThemePreference,
): ThemeState {
  const resolvedTheme = resolveThemePreference(preference);

  applyResolvedDocumentTheme(resolvedTheme);
  window.localStorage.removeItem(LEGACY_THEME_STORAGE_KEY);
  window.localStorage.setItem(THEME_PREFERENCE_STORAGE_KEY, preference);

  return {
    preference,
    resolvedTheme,
  };
}

export function subscribeToSystemThemeChanges(
  callback: (state: ThemeState) => void,
) {
  if (typeof window === "undefined" || !window.matchMedia) {
    return () => undefined;
  }

  const mediaQuery = window.matchMedia(SYSTEM_THEME_QUERY);
  const listener = () => {
    const preference = getStoredThemePreference();

    if (preference !== "system") {
      return;
    }

    const state = applyDocumentThemePreference("system");
    callback(state);
  };

  if (mediaQuery.addEventListener) {
    mediaQuery.addEventListener("change", listener);
    return () => mediaQuery.removeEventListener("change", listener);
  }

  mediaQuery.addListener(listener);
  return () => mediaQuery.removeListener(listener);
}

export function toggleDocumentTheme() {
  const currentTheme = getDocumentThemeState().resolvedTheme;
  return applyDocumentThemePreference(
    currentTheme === "dark" ? "light" : "dark",
  );
}

export function ThemeToggle() {
  const [themeState, setThemeState] = useState<ThemeState>(() =>
    typeof document === "undefined"
      ? DEFAULT_THEME_STATE
      : getDocumentThemeState(),
  );

  useEffect(() => {
    applyDocumentThemePreference(getDocumentThemeState().preference);
    return subscribeToSystemThemeChanges(setThemeState);
  }, []);

  function toggleTheme() {
    setThemeState(toggleDocumentTheme());
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-8 w-8 rounded-full border border-border bg-card text-foreground shadow-none hover:bg-accent/35"
      onClick={toggleTheme}
      aria-label="Toggle color mode"
      title="Toggle color mode"
    >
      {themeState.resolvedTheme === "dark" ? (
        <SunIcon className="size-4" />
      ) : (
        <MoonIcon className="size-4" />
      )}
    </Button>
  );
}
