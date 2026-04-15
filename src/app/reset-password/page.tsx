import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { SiteHeader } from "@/components/layout/site-header";
import { getCurrentIdentity } from "@/lib/auth";

export default async function ResetPasswordPage() {
  const identity = await getCurrentIdentity();

  return (
    <main
      data-smoke-page="reset-password"
      data-smoke-page-ready="reset-password"
      className="min-h-svh bg-background"
    >
      <SiteHeader showNav={false} showAuthAction={false} />
      <div className="mx-auto flex min-h-[calc(100svh-140px)] w-full max-w-6xl items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
        <ResetPasswordForm canReset={Boolean(identity)} />
      </div>
    </main>
  );
}
