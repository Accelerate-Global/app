import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth/auth-form";
import { SiteHeader } from "@/components/layout/site-header";
import { getCurrentOwnerId } from "@/lib/auth";

export default async function SignUpPage() {
  const ownerId = await getCurrentOwnerId();

  if (ownerId) {
    redirect("/dashboard");
  }

  return (
    <main
      data-smoke-page="sign-up"
      data-smoke-page-ready="sign-up"
      className="min-h-svh bg-background"
    >
      <SiteHeader showNav={false} showAuthAction={false} />
      <div className="mx-auto flex min-h-[calc(100svh-140px)] w-full max-w-6xl items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
        <AuthForm mode="sign-up" />
      </div>
    </main>
  );
}
