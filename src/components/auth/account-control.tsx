"use client";

import {
  ChevronDownIcon,
  LogOutIcon,
  MoonIcon,
  PencilIcon,
  SunIcon,
  Trash2Icon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { AccountSettingsDrawer, type AccountDrawerMode } from "@/components/auth/account-settings-drawer";
import {
  applyDocumentTheme,
  getDocumentTheme,
  type AppTheme,
} from "@/components/theme/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { CurrentIdentity } from "@/lib/auth";
import { getSiteNavLinks } from "@/lib/site-navigation";

type AccountControlProps = {
  identity: CurrentIdentity;
};

function getIdentityInitials(fullName: string | null, email: string | null) {
  const source = (fullName?.trim() || email?.split("@")[0] || "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim();

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
  const [activeDrawer, setActiveDrawer] = useState<AccountDrawerMode>(null);
  const [theme, setTheme] = useState<AppTheme>(() =>
    typeof document === "undefined" ? "light" : getDocumentTheme(),
  );
  const accountTypeLabel = identity.isDatasetAdmin ? "Admin" : "Standard";
  const navLinks = useMemo(() => getSiteNavLinks(identity), [identity]);
  const initials = useMemo(
    () => getIdentityInitials(identity.fullName, identity.email),
    [identity.email, identity.fullName],
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

  function openDrawer(mode: Exclude<AccountDrawerMode, null>) {
    setActiveDrawer(mode);
  }

  function navigateTo(href: string) {
    router.push(href);
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              className="flex h-auto items-center gap-3 rounded-[1.25rem] border border-border bg-transparent px-3 py-2 text-left shadow-none transition-colors hover:bg-accent/35"
            />
          }
        >
          <div className="hidden min-w-0 text-right sm:block">
            <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-foreground/55">
              {accountTypeLabel}
            </p>
            <p className="truncate text-sm font-semibold text-foreground">
              {identity.email ?? "Supabase user"}
            </p>
          </div>
          <Avatar className="size-10">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <ChevronDownIcon className="size-4 text-foreground/65" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={12} className="w-80">
          <DropdownMenuLabel className="px-2 py-2">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Avatar className="size-10">
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {identity.fullName ?? "Add full name"}
                  </p>
                  <p className="truncate text-xs font-medium text-muted-foreground">
                    {identity.email ?? "Supabase user"}
                  </p>
                </div>
              </div>

              <div className="grid gap-2 rounded-xl border border-border bg-card px-3 py-3 text-left">
                <div className="grid gap-1">
                  <span className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-foreground/55">
                    Full name
                  </span>
                  <span className="text-sm text-foreground">
                    {identity.fullName ?? "Add full name"}
                  </span>
                </div>
                <div className="grid gap-1">
                  <span className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-foreground/55">
                    Email
                  </span>
                  <span className="text-sm text-foreground">
                    {identity.email ?? "Supabase user"}
                  </span>
                </div>
                <div className="grid gap-1">
                  <span className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-foreground/55">
                    User type
                  </span>
                  <span className="text-sm text-foreground">{accountTypeLabel}</span>
                </div>
              </div>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuLabel inset>Navigate</DropdownMenuLabel>
          {navLinks.map((item) => (
            <DropdownMenuItem
              key={`${item.href}-${item.label}`}
              onClick={() => navigateTo(item.href)}
            >
              {item.label}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuLabel inset>Preferences</DropdownMenuLabel>
          <DropdownMenuItem onClick={toggleTheme}>
            {theme === "dark" ? (
              <SunIcon className="size-4 opacity-70" aria-hidden="true" />
            ) : (
              <MoonIcon className="size-4 opacity-70" aria-hidden="true" />
            )}
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel inset>Account</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => openDrawer("name")}>
            <PencilIcon className="size-4 opacity-70" aria-hidden="true" />
            Update full name
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => openDrawer("email")}>
            <PencilIcon className="size-4 opacity-70" aria-hidden="true" />
            Update email address
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onClick={() => openDrawer("delete")}
          >
            <Trash2Icon className="size-4" aria-hidden="true" />
            Delete account
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={isSigningOut} onClick={signOut}>
            <LogOutIcon className="size-4 opacity-70" aria-hidden="true" />
            {isSigningOut ? "Signing out..." : "Sign out"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AccountSettingsDrawer
        identity={identity}
        mode={activeDrawer}
        open={activeDrawer !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setActiveDrawer(null);
          }
        }}
      />
    </>
  );
}
