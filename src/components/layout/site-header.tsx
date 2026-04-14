import Image from "next/image";
import Link from "next/link";

import { AccountControl } from "@/components/auth/account-control";
import type { CurrentIdentity } from "@/lib/auth";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SiteHeaderProps = {
  identity?: CurrentIdentity | null;
  showNav?: boolean;
  showAuthAction?: boolean;
};

type NavLink = {
  href: string;
  label: string;
};

function getNavLinks(identity: CurrentIdentity | null): NavLink[] {
  if (identity) {
    if (identity.isDatasetAdmin) {
      return [
        { href: "/dashboard", label: "Dashboard" },
        { href: "/dashboard#datasets", label: "Data" },
        { href: "/dashboard/upload", label: "Upload" },
      ];
    }

    return [
      { href: "/dashboard", label: "Dashboard" },
      { href: "/dashboard#datasets", label: "Data" },
    ];
  }

  return [
    { href: "/", label: "Home" },
    { href: "/", label: "Data" },
    { href: "/sign-up", label: "Access" },
  ];
}

export function SiteHeader({
  identity = null,
  showNav = true,
  showAuthAction = true,
}: SiteHeaderProps) {
  const navLinks = getNavLinks(identity);

  return (
    <header className="bg-background">
      <div
        className={cn(
          "mx-auto flex w-full max-w-[1500px] flex-col gap-8 px-4 py-7 sm:px-6 lg:px-8 lg:py-8",
          showNav || showAuthAction
            ? "lg:flex-row lg:items-center lg:justify-between"
            : "items-start",
        )}
      >
        <div className="shrink-0 self-start">
          <Image
            src="/ag-logo.svg"
            alt="Accelerate Global"
            width={504}
            height={146}
            priority
            className="block h-auto w-[220px] sm:w-[270px] lg:w-[320px]"
          />
        </div>

        {showNav ? (
          <nav className="flex flex-1 flex-wrap items-center justify-center gap-x-8 gap-y-3 lg:gap-x-12">
            {navLinks.map((item) => (
              <Link
                key={`${item.href}-${item.label}`}
                href={item.href}
                className="text-[0.98rem] font-medium uppercase tracking-[0.06em] text-foreground transition-opacity hover:opacity-70"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        ) : null}

        {showAuthAction ? (
          <div className="flex shrink-0 items-center justify-end">
            {identity ? (
              <AccountControl identity={identity} />
            ) : (
              <Link
                href="/"
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "h-14 rounded-[1.2rem] border-[3px] border-primary bg-transparent px-6 text-sm font-black uppercase tracking-[0.08em] text-primary shadow-none hover:bg-accent/45",
                )}
              >
                Sign In
              </Link>
            )}
          </div>
        ) : null}
      </div>
    </header>
  );
}
