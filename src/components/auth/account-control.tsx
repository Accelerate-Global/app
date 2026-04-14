"use client";

import { ChevronDownIcon, LogOutIcon, MoonIcon, SunIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  applyDocumentTheme,
  getDocumentTheme,
  type AppTheme,
} from "@/components/theme/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { CurrentIdentity } from "@/lib/auth";

type AccountControlProps = {
  identity: CurrentIdentity;
};

function getIdentityInitials(email: string | null) {
  const source = email?.split("@")[0]?.replace(/[^a-z0-9]+/gi, " ").trim();

  if (!source) {
    return "AG";
  }

  const parts = source.split(/\s+/).filter(Boolean);
  const letters = parts.length > 1
    ? `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`
    : source.slice(0, 2);

  return letters.toUpperCase();
}

export function AccountControl({ identity }: AccountControlProps) {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [theme, setTheme] = useState<AppTheme>(() =>
    typeof document === "undefined" ? "light" : getDocumentTheme(),
  );
  const accessLabel = identity.isDatasetAdmin ? "Admin Access" : "Viewer Access";
  const initials = useMemo(
    () => getIdentityInitials(identity.email),
    [identity.email],
  );

  async function signOut() {
    setIsSigningOut(true);
    await fetch("/auth/sign-out", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    applyDocumentTheme(nextTheme);
    setTheme(nextTheme);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            className="h-auto rounded-[1.25rem] border border-border bg-transparent px-3 py-2 shadow-none hover:bg-accent/35"
          />
        }
      >
        <div className="flex items-center gap-3">
          <div className="hidden min-w-0 text-right sm:block">
            <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-foreground/55">
              {accessLabel}
            </p>
            <p className="truncate text-sm font-semibold text-foreground">
              {identity.email ?? "Supabase user"}
            </p>
          </div>
          <Avatar className="size-10">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <ChevronDownIcon className="size-4 text-foreground/65" />
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={12} className="w-64">
        <DropdownMenuLabel>
          <div className="flex items-center gap-3">
            <Avatar className="size-10">
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-foreground/55">
                {accessLabel}
              </p>
              <p className="truncate text-sm font-semibold text-foreground">
                {identity.email ?? "Supabase user"}
              </p>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={toggleTheme}>
          {theme === "dark" ? (
            <SunIcon className="size-4 opacity-70" aria-hidden="true" />
          ) : (
            <MoonIcon className="size-4 opacity-70" aria-hidden="true" />
          )}
          {theme === "dark" ? "Light mode" : "Dark mode"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          disabled={isSigningOut}
          onClick={signOut}
        >
          <LogOutIcon className="size-4" aria-hidden="true" />
          {isSigningOut ? "Signing out..." : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
