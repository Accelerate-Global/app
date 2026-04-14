"use client";

import { MoonIcon, SunIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

export const THEME_STORAGE_KEY = "ag-theme";

export type AppTheme = "light" | "dark";

export function getDocumentTheme(): AppTheme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function applyDocumentTheme(theme: AppTheme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
  localStorage.setItem(THEME_STORAGE_KEY, theme);
}

export function toggleDocumentTheme() {
  const nextTheme = getDocumentTheme() === "dark" ? "light" : "dark";
  applyDocumentTheme(nextTheme);
  return nextTheme;
}

export function ThemeToggle() {
  function toggleTheme() {
    toggleDocumentTheme();
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
      <MoonIcon className="size-4 dark:hidden" />
      <SunIcon className="hidden size-4 dark:block" />
    </Button>
  );
}
