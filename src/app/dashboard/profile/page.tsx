import { ChevronLeftIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AccountProfileForm } from "@/components/auth/account-profile-form";
import { SiteHeader } from "@/components/layout/site-header";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentIdentity } from "@/lib/auth";
import { cn } from "@/lib/utils";

export default async function ProfilePage() {
  const identity = await getCurrentIdentity();

  if (!identity) {
    redirect("/");
  }

  return (
    <main data-smoke-page="profile" className="min-h-svh bg-background">
      <SiteHeader identity={identity} />
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
        <section className="space-y-2">
          <Link
            href="/dashboard"
            className={cn(
              buttonVariants({ variant: "link", size: "sm" }),
              "inline-flex items-center gap-1 px-0 text-[0.78rem] font-black uppercase tracking-[0.12em] no-underline hover:no-underline",
            )}
          >
            <ChevronLeftIcon className="size-3.5" />
            Back to dashboard
          </Link>
          <h1 className="text-4xl font-semibold tracking-[-0.04em] sm:text-[3.1rem]">
            Profile
          </h1>
          <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
            Manage your account details and security settings.
          </p>
        </section>
        <AccountProfileForm identity={identity} />
      </div>
    </main>
  );
}
