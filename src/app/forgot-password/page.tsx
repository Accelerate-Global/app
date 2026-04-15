import { redirect } from "next/navigation";

import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { SiteHeader } from "@/components/layout/site-header";
import { getCurrentOwnerId } from "@/lib/auth";

type ForgotPasswordPageProps = {
  searchParams: Promise<{
    message?: string;
  }>;
};

export default async function ForgotPasswordPage({
  searchParams,
}: ForgotPasswordPageProps) {
  const ownerId = await getCurrentOwnerId();

  if (ownerId) {
    redirect("/dashboard");
  }

  const { message } = await searchParams;

  return (
    <main data-smoke-page="forgot-password" className="min-h-svh bg-background">
      <SiteHeader showNav={false} showAuthAction={false} />
      <div className="mx-auto flex min-h-[calc(100svh-140px)] w-full max-w-6xl items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
        <ForgotPasswordForm message={message} />
      </div>
    </main>
  );
}
