import { DashboardPageShell } from "@/components/layout/dashboard-page-shell";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <DashboardPageShell>
      <section className="space-y-3">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-12 w-full max-w-md" />
        <Skeleton className="h-5 w-full max-w-2xl" />
      </section>
      <section className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-32 rounded-lg" />
        <Skeleton className="h-32 rounded-lg" />
        <Skeleton className="h-32 rounded-lg" />
      </section>
      <Skeleton className="h-72 rounded-lg" />
    </DashboardPageShell>
  );
}
