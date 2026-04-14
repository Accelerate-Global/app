import Image from "next/image";
import Link from "next/link";

import { AccountControl } from "@/components/auth/account-control";
import type { CurrentIdentity } from "@/lib/auth";
import { buttonVariants } from "@/components/ui/button";
import { getSiteNavLinks } from "@/lib/site-navigation";
import { cn } from "@/lib/utils";

type SiteHeaderProps = {
  identity?: CurrentIdentity | null;
  showNav?: boolean;
  showAuthAction?: boolean;
};

export function SiteHeader({
  identity = null,
  showNav = true,
  showAuthAction = true,
}: SiteHeaderProps) {
  const navLinks = getSiteNavLinks(identity);
  const showNavLinks = showNav && navLinks.length > 0;
  const showRightCluster = showNavLinks || showAuthAction;

  return (
    <header className="bg-background">
      <div
        className={cn(
          "mx-auto flex w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8 lg:py-7",
          showRightCluster
            ? "flex-col gap-6 lg:flex-row lg:items-center lg:justify-between lg:gap-8"
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
            className="block h-auto w-[180px] sm:w-[205px] lg:w-[235px]"
          />
        </div>

        {showRightCluster ? (
          <div className="ml-auto flex w-full flex-col items-start gap-4 sm:items-end lg:w-auto lg:flex-row lg:items-center lg:gap-8">
            {showNavLinks ? (
              <nav className="flex flex-wrap items-center justify-start gap-x-8 gap-y-2 sm:justify-end lg:gap-x-10">
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
              <div className="flex shrink-0 items-center justify-end self-stretch sm:self-auto">
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
        ) : null}
      </div>
    </header>
  );
}
