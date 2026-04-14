"use client";

import {
  ChevronDownIcon,
  LogOutIcon,
  MoonIcon,
  UploadIcon,
  SunIcon,
  UserIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  applyDocumentTheme,
  getDocumentTheme,
  type AppTheme,
} from "@/components/theme/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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

type AccountControlProps = {
  identity: CurrentIdentity;
};

export function AccountControl({ identity }: AccountControlProps) {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [theme, setTheme] = useState<AppTheme>(() =>
    typeof document === "undefined" ? "light" : getDocumentTheme(),
  );
  const displayName = useMemo(() => getIdentityDisplayName(identity), [identity]);
  const initials = useMemo(
    () => getIdentityInitials(identity),
    [identity],
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

  function navigateTo(href: string) {
    router.push(href);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="flex h-14 min-w-[220px] items-center gap-3 rounded-[1.25rem] border border-border bg-background px-4 text-left shadow-none transition-colors hover:bg-accent/35 sm:min-w-[260px]"
          />
        }
      >
        <Avatar size="sm" className="size-7">
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <span className="min-w-0 truncate text-base font-semibold text-foreground">
          {displayName}
        </span>
        <ChevronDownIcon className="ml-auto size-4 text-foreground/60" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={10} className="w-72 rounded-2xl p-2">
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
          {identity.isDatasetAdmin ? (
            <DropdownMenuItem onClick={() => navigateTo("/dashboard/upload")}>
              <UploadIcon aria-hidden="true" />
              Upload
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onClick={toggleTheme}>
            {theme === "dark" ? (
              <SunIcon aria-hidden="true" />
            ) : (
              <MoonIcon aria-hidden="true" />
            )}
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </DropdownMenuItem>
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
