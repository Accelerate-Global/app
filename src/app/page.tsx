import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth/auth-form";
import { SiteHeader } from "@/components/layout/site-header";
import { getCurrentOwnerId } from "@/lib/auth";

type HomePageProps = {
  searchParams: Promise<{
    message?: string;
  }>;
};

export default async function Home({ searchParams }: HomePageProps) {
  const ownerId = await getCurrentOwnerId();

  if (ownerId) {
    redirect("/dashboard");
  }

  const { message } = await searchParams;

  return (
    <main className="min-h-svh bg-background">
      <SiteHeader />
      <div className="mx-auto flex min-h-[calc(100svh-140px)] w-full max-w-6xl items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
        <AuthForm mode="sign-in" message={message} />
      </div>
    </main>
  );
}
