import { ChevronLeftIcon, UsersIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { UserManagementClient } from "@/components/dashboard/user-management-client";
import { DashboardPageShell } from "@/components/layout/dashboard-page-shell";
import { buttonVariants } from "@/components/ui/button";
import { getAnalyticsWorkspaceRole } from "@/lib/analytics";
import { getCurrentIdentity } from "@/lib/auth";
import { listWorkspaceUsers } from "@/lib/user-management";
import { cn } from "@/lib/utils";

export default async function UserManagementPage() {
  const identity = await getCurrentIdentity();

  if (!identity) {
    redirect("/");
  }

  if (!identity.isDatasetAdmin) {
    redirect("/dashboard");
  }

  const users = await listWorkspaceUsers();

  return (
    <div
      data-smoke-page="user-management"
      data-smoke-page-ready="user-management"
    >
      <DashboardPageShell>
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
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-muted text-foreground">
              <UsersIcon className="size-5" />
            </span>
            <div className="space-y-2">
              <h1 className="text-4xl font-semibold tracking-[-0.04em] sm:text-[3.1rem]">
                User Management
              </h1>
              <p className="max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">
                Review account access, invite new users, promote admins, and
                disable accounts from one place.
              </p>
            </div>
          </div>
        </section>
        <UserManagementClient
          currentUserId={identity.ownerId}
          initialUsers={users}
          actorOwnerId={identity.ownerId}
          workspaceRole={getAnalyticsWorkspaceRole(identity.workspaceRole)}
        />
      </DashboardPageShell>
    </div>
  );
}
